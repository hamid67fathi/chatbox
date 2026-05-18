import { and, desc, eq, exists, lt, sql } from "drizzle-orm";
import { forbidden } from "../lib/auth.js";
import {
	banWorkspaceContact,
	unbanWorkspaceContact,
} from "../lib/contact-ban.js";
import { addWorkspaceBannedIp, visitorIpFromMetadata } from "../lib/ip-ban.js";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
	contacts,
	conversationNotes,
	conversationTags,
	conversations,
	messages,
} from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
	agentInboxVisibilityCondition,
	assertConversationAccess,
	getWorkspaceRole,
	isSupervisorRole,
} from "../lib/conversation-access.js";
import { notFound, validationError } from "../lib/errors.js";
import {
	assertCanCreateConversation,
	notifyPlanUsageIfNeeded,
} from "../lib/plan-limits.js";
import { getWorkspaceId } from "../lib/workspace.js";
import {
	parseHandoffBrief,
	refreshConversationSummary,
	refreshHandoffBrief,
} from "../lib/conversation-insights.js";
import {
	archiveMetadataPatch,
	archivedCondition,
	notArchivedCondition,
	unarchiveMetadataPatch,
} from "../lib/conversation-archive.js";
import { computeSlaStatus, getSlaPolicyForWorkspace } from "../lib/sla/index.js";
import { triggerAutoTagging } from "../lib/auto-tag.js";
import { emitCsatRequest } from "../lib/csat-service.js";
import { recordResolvedIfNeeded } from "../lib/sla/record.js";
import { getIO } from "../ws/broadcast.js";
import {
	serializeVisitorForApi,
	visitorFromMetadata,
} from "../lib/visitor-context.js";

export async function conversationRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: {
			status?: string;
			channel?: string;
			assigned_to?: string;
			limit?: string;
			cursor?: string;
			include_empty?: string;
			archived?: string;
		};
	}>("/v1/conversations", async (request) => {
		const wsId = getWorkspaceId(request);
		const user = (request as AuthenticatedRequest).user;
		const role = await getWorkspaceRole(wsId, user.id);
		const limit = Math.min(Number(request.query.limit) || 30, 100);
		const sortAt = sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`;

		const conditions = [eq(conversations.workspaceId, wsId)];

		if (role && !isSupervisorRole(role)) {
			conditions.push(agentInboxVisibilityCondition(user.id));
		}

		if (request.query.cursor) {
			conditions.push(lt(sortAt, new Date(request.query.cursor)));
		}

		if (request.query.include_empty !== "true") {
			conditions.push(
				exists(
					db
						.select({ x: sql`1` })
						.from(messages)
						.where(
							and(
								eq(messages.conversationId, conversations.id),
								eq(messages.workspaceId, wsId),
							),
						),
				),
			);
		}

		const archivedFilter = request.query.archived ?? "false";
		if (archivedFilter === "true") {
			conditions.push(archivedCondition);
		} else if (archivedFilter !== "all") {
			conditions.push(notArchivedCondition);
		}

		if (request.query.status) {
			conditions.push(eq(conversations.status, request.query.status as "open"));
		}
		if (request.query.channel) {
			conditions.push(
				eq(conversations.channel, request.query.channel as "widget"),
			);
		}
		if (request.query.assigned_to) {
			conditions.push(
				eq(conversations.assignedAgentId, request.query.assigned_to),
			);
		}

		const rows = await db.query.conversations.findMany({
			where: and(...conditions),
			limit,
			orderBy: [desc(sortAt)],
			with: { contact: true },
		});

		const slaPolicy = await getSlaPolicyForWorkspace(wsId);
		const data = rows.map((row) => ({
			...row,
			sla: computeSlaStatus(row, slaPolicy),
		}));

		const last = rows[rows.length - 1];
		const nextCursor =
			rows.length === limit && last
				? (last.lastMessageAt ?? last.createdAt)?.toISOString() ?? null
				: null;

		return {
			data,
			page: { limit, next_cursor: nextCursor, has_more: rows.length === limit },
		};
	});

	app.get<{ Params: { id: string } }>(
		"/v1/conversations/:id",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const row = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
				with: {
					contact: true,
					tags: true,
					notes: {
						with: { author: true },
						orderBy: (n, { desc: d }) => [d(n.createdAt)],
					},
					assignedAgent: true,
				},
			});
			if (!row) throw notFound("Conversation not found.");

			const user = (request as AuthenticatedRequest).user;
			await assertConversationAccess(row, wsId, user.id);

			const { tags, notes, contact, ...conv } = row;
			const slaPolicy = await getSlaPolicyForWorkspace(wsId);
			const visitor = contact
				? visitorFromMetadata(contact.metadata)
				: null;
			const handoffBrief = parseHandoffBrief(conv.metadata);
			const meta =
				conv.metadata && typeof conv.metadata === "object"
					? (conv.metadata as Record<string, unknown>)
					: {};
			return {
				...conv,
				sla: computeSlaStatus(conv, slaPolicy),
				visitor: serializeVisitorForApi(visitor, contact?.metadata),
				summary:
					typeof meta.summary === "string" ? meta.summary : null,
				handoff_brief: handoffBrief,
				contact,
				tags: tags.map((t) => t.tag),
				notes: notes.map((n) => ({
					id: n.id,
					body: n.body,
					createdAt: n.createdAt,
					author: n.author
						? {
								id: n.author.id,
								email: n.author.email,
								fullName: n.author.fullName,
							}
						: null,
				})),
			};
		},
	);

	app.post<{
		Body: {
			contact_id: string;
			channel: string;
			subject?: string;
			first_message?: { type?: string; body: string };
		};
	}>("/v1/conversations", async (request, reply) => {
		const wsId = getWorkspaceId(request);
		const { contact_id, channel, subject, first_message } = request.body ?? {};

		if (!contact_id)
			throw validationError("contact_id is required.", "contact_id");
		if (!channel) throw validationError("channel is required.", "channel");

		await assertCanCreateConversation(wsId);

		const [conv] = await db
			.insert(conversations)
			.values({
				workspaceId: wsId,
				contactId: contact_id,
				channel: channel as "widget",
				subject,
			})
			.returning();

		void notifyPlanUsageIfNeeded(wsId);

		if (first_message?.body) {
			await db.insert(messages).values({
				workspaceId: wsId,
				conversationId: conv.id,
				senderType: "contact",
				senderContactId: contact_id,
				type: (first_message.type as "text") ?? "text",
				body: first_message.body,
			});
		}

		return reply.status(201).send(conv);
	});

	app.post<{ Params: { id: string }; Body: { status: string } }>(
		"/v1/conversations/:id/status",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const { status } = request.body ?? {};
			if (!status) throw validationError("status is required.", "status");

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			await assertConversationAccess(existing, wsId, user.id);

			const [updated] = await db
				.update(conversations)
				.set({
					status: status as "open",
					...(status === "closed" || status === "resolved"
						? { closedAt: new Date() }
						: {}),
				})
				.where(
					and(
						eq(conversations.id, request.params.id),
						eq(conversations.workspaceId, wsId),
					),
				)
				.returning();

			if (!updated) throw notFound("Conversation not found.");

			await recordResolvedIfNeeded(request.params.id, status);

			if (status === "resolved" || status === "closed") {
				void emitCsatRequest(wsId, request.params.id);
				triggerAutoTagging(wsId, request.params.id);
				const { dispatchWebhookEvent } = await import(
					"../lib/webhooks/index.js"
				);
				void dispatchWebhookEvent(wsId, "conversation.resolved", {
					conversation: {
						id: updated.id,
						status: updated.status,
						channel: updated.channel,
						resolved_at: updated.resolvedAt?.toISOString() ?? null,
						closed_at: updated.closedAt?.toISOString() ?? null,
					},
				});
			}

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`)
					.to(`conversation:${request.params.id}`)
					.emit("conv:status_changed", {
						conv_id: request.params.id,
						status,
					});
			} catch {
				/* socket.io not yet initialized */
			}

			return updated;
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/archive",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			await assertConversationAccess(existing, wsId, user.id);

			const [updated] = await db
				.update(conversations)
				.set({
					metadata: archiveMetadataPatch(existing.metadata, user.id),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(conversations.id, request.params.id),
						eq(conversations.workspaceId, wsId),
					),
				)
				.returning();

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`).emit("conv:archived", {
					conv_id: request.params.id,
				});
			} catch {
				/* socket not ready */
			}

			return updated;
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/unarchive",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			await assertConversationAccess(existing, wsId, user.id);

			const [updated] = await db
				.update(conversations)
				.set({
					metadata: unarchiveMetadataPatch(existing.metadata),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(conversations.id, request.params.id),
						eq(conversations.workspaceId, wsId),
					),
				)
				.returning();

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`).emit("conv:unarchived", {
					conv_id: request.params.id,
				});
			} catch {
				/* socket not ready */
			}

			return updated;
		},
	);

	app.post<{ Params: { id: string }; Body: { reason?: string } }>(
		"/v1/conversations/:id/ban-contact",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			const role = await assertConversationAccess(existing, wsId, user.id);
			if (!isSupervisorRole(role)) {
				throw forbidden("Only workspace admins can ban contacts.");
			}

			const contact = await banWorkspaceContact(
				wsId,
				existing.contactId,
				user.id,
				request.body?.reason,
			);

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`).emit("contact:banned", {
					contact_id: contact.id,
					conversation_id: request.params.id,
				});
			} catch {
				/* socket not ready */
			}

			return { contact, banned: true };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/unban-contact",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			const role = await assertConversationAccess(existing, wsId, user.id);
			if (!isSupervisorRole(role)) {
				throw forbidden("Only workspace admins can unban contacts.");
			}

			const contact = await unbanWorkspaceContact(wsId, existing.contactId);

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`).emit("contact:unbanned", {
					contact_id: contact.id,
					conversation_id: request.params.id,
				});
			} catch {
				/* socket not ready */
			}

			return { contact, banned: false };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/ban-ip",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
				with: { contact: true },
			});
			if (!existing) throw notFound("Conversation not found.");
			const role = await assertConversationAccess(existing, wsId, user.id);
			if (!isSupervisorRole(role)) {
				throw forbidden("Only workspace admins can ban IPs.");
			}

			const ip = visitorIpFromMetadata(existing.contact?.metadata);
			if (!ip) {
				throw validationError(
					"Visitor IP is not available for this conversation yet.",
					"ip",
				);
			}

			const banned_ips = await addWorkspaceBannedIp(wsId, ip);

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`).emit("security:ip_banned", {
					ip,
					conversation_id: request.params.id,
				});
			} catch {
				/* socket not ready */
			}

			return { ip, banned_ips };
		},
	);

	app.post<{ Params: { id: string }; Body: { agent_id: string | null } }>(
		"/v1/conversations/:id/assign",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const { agent_id } = request.body ?? {};
			if (agent_id === undefined)
				throw validationError("agent_id is required (use null to unassign).", "agent_id");

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			await assertConversationAccess(existing, wsId, user.id);

			const [updated] = await db
				.update(conversations)
				.set({ assignedAgentId: agent_id || null })
				.where(
					and(
						eq(conversations.id, request.params.id),
						eq(conversations.workspaceId, wsId),
					),
				)
				.returning();

			if (!updated) throw notFound("Conversation not found.");

			try {
				const io = getIO();
				io.to(`workspace:${wsId}`)
					.to(`conversation:${request.params.id}`)
					.emit("conv:assigned", {
						conv_id: request.params.id,
						agent_id,
					});
			} catch {
				/* socket.io not yet initialized */
			}

			if (agent_id) {
				const contact = await db.query.contacts.findFirst({
					where: eq(contacts.id, updated.contactId),
					columns: { fullName: true },
				});
				const { emailNotifyAssigned } = await import(
					"../lib/email-notifications/index.js"
				);
				void emailNotifyAssigned(
					wsId,
					request.params.id,
					agent_id,
					contact?.fullName ?? null,
				);
			}

			return updated;
		},
	);

	app.post<{ Params: { id: string }; Body: { tags: string[] } }>(
		"/v1/conversations/:id/tags",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const { tags } = request.body ?? {};
			if (!tags?.length)
				throw validationError("tags array is required.", "tags");

			const conv = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!conv) throw notFound("Conversation not found.");
			const user = (request as AuthenticatedRequest).user;
			await assertConversationAccess(conv, wsId, user.id);

			const values = tags.map((tag) => ({
				conversationId: request.params.id,
				tag,
			}));

			await db.insert(conversationTags).values(values).onConflictDoNothing();

			return { ok: true };
		},
	);

	app.post<{ Params: { id: string }; Body: { priority: number } }>(
		"/v1/conversations/:id/priority",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const priority = Number(request.body?.priority);
			if (Number.isNaN(priority) || priority < 0 || priority > 3) {
				throw validationError("priority must be 0–3.", "priority");
			}

			const existing = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Conversation not found.");
			await assertConversationAccess(existing, wsId, user.id);

			const [updated] = await db
				.update(conversations)
				.set({ priority })
				.where(
					and(
						eq(conversations.id, request.params.id),
						eq(conversations.workspaceId, wsId),
					),
				)
				.returning();

			if (!updated) throw notFound("Conversation not found.");
			return updated;
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/conversations/:id/notes",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const conv = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!conv) throw notFound("Conversation not found.");
			const user = (request as AuthenticatedRequest).user;
			await assertConversationAccess(conv, wsId, user.id);

			const notes = await db.query.conversationNotes.findMany({
				where: eq(conversationNotes.conversationId, request.params.id),
				orderBy: (n, { desc: d }) => [d(n.createdAt)],
				with: { author: true },
			});

			return {
				data: notes.map((n) => ({
					id: n.id,
					body: n.body,
					createdAt: n.createdAt,
					author: n.author
						? {
								id: n.author.id,
								email: n.author.email,
								fullName: n.author.fullName,
							}
						: null,
				})),
			};
		},
	);

	app.post<{ Params: { id: string }; Body: { body: string } }>(
		"/v1/conversations/:id/notes",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const { body } = request.body ?? {};
			if (!body?.trim()) throw validationError("body is required.", "body");

			const conv = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, request.params.id),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!conv) throw notFound("Conversation not found.");
			await assertConversationAccess(conv, wsId, user.id);

			const [note] = await db
				.insert(conversationNotes)
				.values({
					conversationId: request.params.id,
					authorId: user.id,
					body: body.trim(),
				})
				.returning();

			const { emailNotifyNoteMentions } = await import(
				"../lib/email-notifications/index.js"
			);
			void emailNotifyNoteMentions(
				wsId,
				request.params.id,
				user.id,
				body.trim(),
			);

			return {
				id: note.id,
				body: note.body,
				createdAt: note.createdAt,
				author: { id: user.id, email: user.email, fullName: null },
			};
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/conversations/:id/handoff-brief",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const convId = request.params.id;
			const user = (request as AuthenticatedRequest).user;

			const row = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, convId),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!row) throw notFound("Conversation not found.");
			await assertConversationAccess(row, wsId, user.id);

			let brief = parseHandoffBrief(row.metadata);
			if (!brief) {
				brief = await refreshHandoffBrief(wsId, convId, user.id);
			}
			return { data: brief };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/handoff-brief",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const convId = request.params.id;
			const user = (request as AuthenticatedRequest).user;

			const row = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, convId),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!row) throw notFound("Conversation not found.");
			await assertConversationAccess(row, wsId, user.id);

			const brief = await refreshHandoffBrief(wsId, convId, user.id);
			return {
				data: brief,
				message: brief ? undefined : "تهیه بریف ارجاع در دسترس نبود.",
			};
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/summary",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const convId = request.params.id;
			const user = (request as AuthenticatedRequest).user;

			const row = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.id, convId),
					eq(conversations.workspaceId, wsId),
				),
			});
			if (!row) throw notFound("Conversation not found.");
			await assertConversationAccess(row, wsId, user.id);

			const summary = await refreshConversationSummary(
				wsId,
				convId,
				"manual",
				user.id,
			);

			return {
				data: {
					summary,
					message: summary
						? undefined
						: "خلاصه‌سازی در دسترس نبود.",
				},
			};
		},
	);
}
