import { and, desc, eq, exists, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
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
import { refreshConversationSummary } from "../lib/conversation-insights.js";
import { getIO } from "../ws/broadcast.js";

export async function conversationRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: {
			status?: string;
			channel?: string;
			assigned_to?: string;
			limit?: string;
			cursor?: string;
			include_empty?: string;
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

		const last = rows[rows.length - 1];
		const nextCursor =
			rows.length === limit && last
				? (last.lastMessageAt ?? last.createdAt)?.toISOString() ?? null
				: null;

		return {
			data: rows,
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

			const { tags, notes, ...conv } = row;
			return {
				...conv,
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
					...(status === "closed" ? { closedAt: new Date() } : {}),
				})
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

			return {
				id: note.id,
				body: note.body,
				createdAt: note.createdAt,
				author: { id: user.id, email: user.email, fullName: null },
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
