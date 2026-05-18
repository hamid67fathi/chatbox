import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { contacts, conversations, messages, workspaces } from "../db/schema/index.js";
import {
	isContactProfileComplete,
	parsePrechatConfig,
	validatePrechatPayload,
} from "../lib/prechat-settings.js";
import {
	type VisitorTokenPayload,
	signVisitorToken,
	unauthorized,
	verifyToken,
} from "../lib/auth.js";
import { validateMessagePayload } from "../lib/attachments.js";
import {
	assertCanCreateConversation,
	notifyPlanUsageIfNeeded,
} from "../lib/plan-limits.js";
import { saveWorkspaceUpload } from "../lib/uploads.js";
import { isContactBanned } from "../lib/contact-ban.js";
import { contactBanned, notFound, validationError } from "../lib/errors.js";
import { ensureAwayMessageForConversation } from "../lib/business-hours-handler.js";
import {
	getCsatPendingForConversation,
	submitCsatResponse,
} from "../lib/csat-service.js";
import {
	processContactMessageInFlow,
	tryStartWidgetFlow,
} from "../lib/flow-engine/index.js";
import {
	broadcastNewConversation,
	deliverNewMessage,
	triggerAIReply,
} from "../lib/message-delivery.js";
import { publicWidgetConfigHandler } from "./widget-config.js";
import {
	captureVisitorContext,
	mergeVisitorMetadata,
	serializeVisitorForApi,
	visitorFromMetadata,
} from "../lib/visitor-context.js";
import { assertWorkspaceIpAllowed } from "../lib/workspace-ip-guard.js";
import {
	findContactByVisitorId,
	resolveContactIdentity,
} from "../lib/identity-resolution.js";
import {
	recordVisitorEvent,
	trackContextFromRequest,
} from "../lib/visitor-events.js";
import { getIO } from "../ws/broadcast.js";

async function openConversationForContact(
	workspaceId: string,
	contactId: string,
) {
	return db.query.conversations.findFirst({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
			eq(conversations.status, "open"),
		),
		orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
	});
}

async function assertVisitorNotBanned(contactId: string, workspaceId: string) {
	const contact = await db.query.contacts.findFirst({
		where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
	});
	if (contact && isContactBanned(contact.metadata)) throw contactBanned();
}

async function requireVisitorToken(
	request: FastifyRequest,
	_reply: FastifyReply,
): Promise<void> {
	const header = request.headers.authorization;
	if (!header?.startsWith("Bearer ")) throw unauthorized("Visitor token required.");

	const token = header.slice(7);
	try {
		const payload = await verifyToken<VisitorTokenPayload>(token);
		if (payload.type !== "visitor") throw unauthorized("Invalid token type.");
		(request as VisitorRequest).visitor = {
			contactId: payload.sub,
			workspaceId: payload.wid,
			conversationId: payload.cid,
		};
		await assertVisitorNotBanned(payload.sub, payload.wid);
		await assertWorkspaceIpAllowed(request, payload.wid);
	} catch (err) {
		if (err instanceof Error && "statusCode" in err) throw err;
		throw unauthorized("Invalid or expired visitor token.");
	}
}

interface VisitorRequest extends FastifyRequest {
	visitor: { contactId: string; workspaceId: string; conversationId: string };
}

export async function widgetRoutes(app: FastifyInstance) {
	app.get<{ Querystring: { workspace_slug?: string } }>(
		"/widget/v1/config",
		{ config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
		async (request) => publicWidgetConfigHandler(request.query.workspace_slug),
	);

	async function persistVisitorContext(
		contactId: string,
		workspaceId: string,
		conversationId: string,
		request: FastifyRequest,
		input?: {
			pageUrl?: string | null;
			pageTitle?: string | null;
			metadata?: Record<string, unknown> | null;
		},
	) {
		const existing = await db.query.contacts.findFirst({
			where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
		});
		if (!existing) return;
		if (isContactBanned(existing.metadata)) throw contactBanned();

		const pageTitle =
			typeof input?.pageTitle === "string" ? input.pageTitle : null;
		const ctx = captureVisitorContext(request, input);
		const metadata = mergeVisitorMetadata(
			existing.metadata,
			ctx,
			pageTitle,
		);

		const [updated] = await db
			.update(contacts)
			.set({
				metadata,
				lastSeenAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
			)
			.returning();

		const finalMeta = updated?.metadata ?? metadata;
		const visitor = visitorFromMetadata(finalMeta);
		try {
			const io = getIO();
			io.to(`workspace:${workspaceId}`).emit("visitor:context", {
				conversation_id: conversationId,
				contact_id: contactId,
				visitor: serializeVisitorForApi(visitor, finalMeta),
			});
		} catch {
			/* socket not ready */
		}
	}

	app.post<{
		Body: {
			workspace_slug: string;
			visitor_id?: string | null;
			page_url?: string | null;
			page_title?: string | null;
			metadata?: Record<string, unknown> | null;
		};
	}>(
		"/widget/v1/sessions",
		{ config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const { workspace_slug, visitor_id, page_url, page_title, metadata } =
				request.body ?? {};
			if (!workspace_slug)
				throw validationError("workspace_slug is required.", "workspace_slug");

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.slug, workspace_slug),
			});
			if (!ws) throw notFound("Workspace not found.");

			await assertWorkspaceIpAllowed(request, ws.id);

			let contact = visitor_id
				? await findContactByVisitorId(ws.id, visitor_id)
				: null;

			if (!contact) {
				const newVisitorId = visitor_id ?? randomUUID();
				const initialCtx = captureVisitorContext(request, {
					pageUrl: page_url,
					metadata,
				});
				const initialMeta = mergeVisitorMetadata(
					{},
					initialCtx,
					typeof page_title === "string" ? page_title : null,
				);
				const [created] = await db
					.insert(contacts)
					.values({
						workspaceId: ws.id,
						externalId: newVisitorId,
						fullName: "Visitor",
						metadata: initialMeta,
					})
					.returning();
				contact = created;
			}

			if (isContactBanned(contact.metadata)) {
				throw contactBanned();
			}

			const existingConv = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.workspaceId, ws.id),
					eq(conversations.contactId, contact.id),
					eq(conversations.status, "open"),
				),
				orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
			});

			let conv = existingConv;
			let isNewConversation = false;
			if (!conv) {
				await assertCanCreateConversation(ws.id);
				[conv] = await db
					.insert(conversations)
					.values({
						workspaceId: ws.id,
						contactId: contact.id,
						channel: "widget",
						status: "open",
					})
					.returning();
				isNewConversation = true;
				broadcastNewConversation(conv, contact);
				void notifyPlanUsageIfNeeded(ws.id);
			}

			await persistVisitorContext(contact.id, ws.id, conv.id, request, {
				pageUrl: page_url,
				pageTitle: typeof page_title === "string" ? page_title : null,
				metadata,
			});

			const trackCtx = trackContextFromRequest(request);
			const vid = contact.externalId ?? visitor_id ?? "";
			if (vid) {
				void recordVisitorEvent({
					workspaceId: ws.id,
					visitorId: vid,
					eventType: "session_start",
					url: page_url ?? null,
					contactId: contact.id,
					ip: trackCtx.ip,
					userAgent: trackCtx.userAgent,
					payload:
						metadata && typeof metadata === "object"
							? (metadata as Record<string, unknown>)
							: {},
				});
				if (isNewConversation) {
					void recordVisitorEvent({
						workspaceId: ws.id,
						visitorId: vid,
						eventType: "conversation_started",
						url: page_url ?? null,
						contactId: contact.id,
						payload: { conversation_id: conv.id },
						ip: trackCtx.ip,
						userAgent: trackCtx.userAgent,
					});
				}
			}

			if (isNewConversation) {
				void (async () => {
					const closed = await ensureAwayMessageForConversation(
						ws.id,
						conv.id,
					);
					if (!closed) {
						await tryStartWidgetFlow(ws.id, conv.id, contact.id);
					}
				})();
			}

			const token = await signVisitorToken(contact.id, ws.id, conv.id);
			const prechat = parsePrechatConfig(ws.settings);
			const profile = {
				fullName: contact.fullName,
				email: contact.email,
				phone: contact.phone,
			};

			return reply.status(201).send({
				workspace_id: ws.id,
				conversation_id: conv.id,
				contact_id: contact.id,
				visitor_id: contact.externalId,
				token,
				profile_complete: isContactProfileComplete(profile, prechat),
				contact: {
					full_name: contact.fullName,
					email: contact.email,
					phone: contact.phone,
				},
			});
		},
	);

	app.patch<{
		Body: {
			page_url?: string | null;
			page_title?: string | null;
			metadata?: Record<string, unknown> | null;
		};
	}>(
		"/widget/v1/visitor-context",
		{ preHandler: [requireVisitorToken] },
		async (request) => {
			const { contactId, workspaceId, conversationId } = (request as VisitorRequest)
				.visitor;
			const { page_url, page_title, metadata } = request.body ?? {};
			await persistVisitorContext(
				contactId,
				workspaceId,
				conversationId,
				request,
				{
					pageUrl: page_url,
					pageTitle: typeof page_title === "string" ? page_title : null,
					metadata,
				},
			);
			const contact = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.id, contactId),
					eq(contacts.workspaceId, workspaceId),
				),
			});
			return {
				visitor: serializeVisitorForApi(
					visitorFromMetadata(contact?.metadata),
					contact?.metadata,
				),
			};
		},
	);

	app.patch<{
		Body: { full_name?: string; email?: string; phone?: string };
	}>(
		"/widget/v1/contact",
		{ preHandler: [requireVisitorToken] },
		async (request) => {
			const { contactId, workspaceId } = (request as VisitorRequest).visitor;
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, workspaceId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const existing = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.id, contactId),
					eq(contacts.workspaceId, workspaceId),
				),
			});
			if (!existing) throw notFound("Contact not found.");

			const prechat = parsePrechatConfig(ws.settings);
			const body = request.body ?? {};
			const merged = {
				full_name:
					body.full_name !== undefined
						? body.full_name
						: (existing.fullName ?? undefined),
				email:
					body.email !== undefined ? body.email : (existing.email ?? undefined),
				phone:
					body.phone !== undefined ? body.phone : (existing.phone ?? undefined),
			};

			let parsed: ReturnType<typeof validatePrechatPayload>;
			try {
				parsed = validatePrechatPayload(prechat, merged);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				const field = msg.includes("email")
					? "email"
					: msg.includes("phone")
						? "phone"
						: "full_name";
				throw validationError(msg, field);
			}

			const [updated] = await db
				.update(contacts)
				.set({
					fullName: parsed.fullName,
					email: parsed.email,
					phone: parsed.phone,
					lastSeenAt: new Date(),
					updatedAt: new Date(),
				})
				.where(
					and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
				)
				.returning();

			if (!updated) throw notFound("Contact not found.");

			const identity = await resolveContactIdentity(ws.id, {
				sourceContactId: updated.id,
				email: updated.email,
				phone: updated.phone,
				visitorId: updated.externalId,
				method: "prechat",
			});

			let finalContact = updated;
			let conversationId = (request as VisitorRequest).visitor.conversationId;
			let token: string | undefined;

			if (identity.merged) {
				const canonical = await db.query.contacts.findFirst({
					where: and(
						eq(contacts.id, identity.contactId),
						eq(contacts.workspaceId, workspaceId),
					),
				});
				if (!canonical) throw notFound("Contact not found.");
				finalContact = canonical;
				const conv =
					(await openConversationForContact(workspaceId, canonical.id)) ??
					(await db.query.conversations.findFirst({
						where: and(
							eq(conversations.workspaceId, workspaceId),
							eq(conversations.contactId, canonical.id),
						),
						orderBy: [
							desc(conversations.lastMessageAt),
							desc(conversations.createdAt),
						],
					}));
				if (!conv) throw notFound("Conversation not found.");
				conversationId = conv.id;
				token = await signVisitorToken(canonical.id, workspaceId, conv.id);
			}

			const profile = {
				fullName: finalContact.fullName,
				email: finalContact.email,
				phone: finalContact.phone,
			};

			return {
				profile_complete: isContactProfileComplete(profile, prechat),
				contact_id: finalContact.id,
				conversation_id: conversationId,
				visitor_id: finalContact.externalId,
				...(token ? { token } : {}),
				identity_merged: identity.merged,
				contact: {
					full_name: finalContact.fullName,
					email: finalContact.email,
					phone: finalContact.phone,
				},
			};
		},
	);

	app.post(
		"/widget/v1/uploads",
		{ preHandler: [requireVisitorToken] },
		async (request) => {
			const { workspaceId } = (request as VisitorRequest).visitor;
			const data = await request.file();
			if (!data) throw validationError("file is required.", "file");

			const chunks: Buffer[] = [];
			for await (const chunk of data.file) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}
			const attachment = await saveWorkspaceUpload(workspaceId, {
				filename: data.filename,
				mimetype: data.mimetype,
				buffer: Buffer.concat(chunks),
			});
			return { data: attachment };
		},
	);

	app.get(
		"/widget/v1/messages",
		{ preHandler: [requireVisitorToken] },
		async (request) => {
			const { workspaceId, conversationId } = (request as VisitorRequest).visitor;

			const rows = await db.query.messages.findMany({
				where: and(
					eq(messages.workspaceId, workspaceId),
					eq(messages.conversationId, conversationId),
				),
				limit: 100,
				orderBy: (m, { asc }) => [asc(m.createdAt)],
			});

			return {
				data: rows.map((row) => ({
					id: row.id,
					body: row.body ?? "",
					sender_type: row.senderType,
					type: row.type,
					attachments: row.attachments,
					created_at: row.createdAt,
					read_at: row.readAt,
					delivered_at: row.deliveredAt,
				})),
			};
		},
	);

	app.post<{
		Body: { body?: string; type?: string; attachments?: unknown };
	}>(
		"/widget/v1/messages",
		{ preHandler: [requireVisitorToken] },
		async (request, reply) => {
			const { workspaceId, conversationId, contactId } = (request as VisitorRequest).visitor;
			const payload = validateMessagePayload(request.body ?? {});

			const [msg] = await db
				.insert(messages)
				.values({
					workspaceId,
					conversationId,
					senderType: "contact",
					senderContactId: contactId,
					type: payload.type,
					body: payload.body,
					attachments: payload.attachments,
				})
				.returning();

			await deliverNewMessage(msg, conversationId, workspaceId);
			if (payload.type === "text") {
				void ensureAwayMessageForConversation(workspaceId, conversationId);
				const handled = await processContactMessageInFlow(
					conversationId,
					payload.body,
				);
				if (!handled) {
					triggerAIReply(workspaceId, conversationId, payload.body, msg.id);
				}
			}

			return reply.status(201).send(msg);
		},
	);

	app.get(
		"/widget/v1/csat/pending",
		{ preHandler: [requireVisitorToken] },
		async (request) => {
			const { workspaceId, conversationId } = (request as VisitorRequest).visitor;
			return getCsatPendingForConversation(workspaceId, conversationId);
		},
	);

	app.post<{ Body: { score?: number; comment?: string | null } }>(
		"/widget/v1/csat",
		{ preHandler: [requireVisitorToken] },
		async (request, reply) => {
			const { workspaceId, conversationId, contactId } = (request as VisitorRequest)
				.visitor;
			const score = request.body?.score;
			if (typeof score !== "number") {
				throw validationError("score is required.", "score");
			}

			const result = await submitCsatResponse({
				workspaceId,
				conversationId,
				contactId,
				score,
				comment: request.body?.comment,
			});
			if (!result.ok) {
				return reply.status(400).send({
					error: { message: result.error },
				});
			}
			return reply.status(201).send({ ok: true });
		},
	);
}
