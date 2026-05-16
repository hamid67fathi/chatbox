import { and, desc, eq, exists, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
	conversationTags,
	conversations,
	messages,
} from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";
import { getWorkspaceId } from "../lib/workspace.js";
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
		const limit = Math.min(Number(request.query.limit) || 30, 100);
		const sortAt = sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`;

		const conditions = [eq(conversations.workspaceId, wsId)];

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
			});
			if (!row) throw notFound("Conversation not found.");
			return row;
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

		const [conv] = await db
			.insert(conversations)
			.values({
				workspaceId: wsId,
				contactId: contact_id,
				channel: channel as "widget",
				subject,
			})
			.returning();

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
			const { status } = request.body ?? {};
			if (!status) throw validationError("status is required.", "status");

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

	app.post<{ Params: { id: string }; Body: { agent_id: string } }>(
		"/v1/conversations/:id/assign",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const { agent_id } = request.body ?? {};
			if (!agent_id) throw validationError("agent_id is required.", "agent_id");

			const [updated] = await db
				.update(conversations)
				.set({ assignedAgentId: agent_id })
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

			const values = tags.map((tag) => ({
				conversationId: request.params.id,
				tag,
			}));

			await db.insert(conversationTags).values(values).onConflictDoNothing();

			return { ok: true };
		},
	);
}
