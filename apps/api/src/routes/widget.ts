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
import { saveWorkspaceUpload } from "../lib/uploads.js";
import { notFound, validationError } from "../lib/errors.js";
import {
	broadcastNewConversation,
	deliverNewMessage,
	triggerAIReply,
} from "../lib/message-delivery.js";
import { publicWidgetConfigHandler } from "./widget-config.js";

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

	app.post<{
		Body: {
			workspace_slug: string;
			visitor_id?: string | null;
		};
	}>(
		"/widget/v1/sessions",
		{ config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const { workspace_slug, visitor_id } = request.body ?? {};
			if (!workspace_slug)
				throw validationError("workspace_slug is required.", "workspace_slug");

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.slug, workspace_slug),
			});
			if (!ws) throw notFound("Workspace not found.");

			let contact = visitor_id
				? await db.query.contacts.findFirst({
						where: and(
							eq(contacts.externalId, visitor_id),
							eq(contacts.workspaceId, ws.id),
						),
					})
				: null;

			if (!contact) {
				const newVisitorId = visitor_id ?? randomUUID();
				const [created] = await db
					.insert(contacts)
					.values({
						workspaceId: ws.id,
						externalId: newVisitorId,
						fullName: "Visitor",
					})
					.returning();
				contact = created;
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
			if (!conv) {
				[conv] = await db
					.insert(conversations)
					.values({
						workspaceId: ws.id,
						contactId: contact.id,
						channel: "widget",
						status: "open",
					})
					.returning();
				broadcastNewConversation(conv, contact);
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

			const profile = {
				fullName: updated.fullName,
				email: updated.email,
				phone: updated.phone,
			};

			return {
				profile_complete: isContactProfileComplete(profile, prechat),
				contact: {
					full_name: updated.fullName,
					email: updated.email,
					phone: updated.phone,
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
				triggerAIReply(workspaceId, conversationId, payload.body, msg.id);
			}

			return reply.status(201).send(msg);
		},
	);
}
