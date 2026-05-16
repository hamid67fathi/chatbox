import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { conversations, messages } from "../db/schema/index.js";
import {
	deliverNewMessage,
	triggerAIReply,
} from "../lib/message-delivery.js";
import { notFound, validationError } from "../lib/errors.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function messageRoutes(app: FastifyInstance) {
	app.get<{
		Params: { id: string };
		Querystring: { limit?: string; cursor?: string; since?: string };
	}>("/v1/conversations/:id/messages", async (request) => {
		const wsId = getWorkspaceId(request);
		const convId = request.params.id;
		const limit = Math.min(Number(request.query.limit) || 50, 100);

		const conv = await db.query.conversations.findFirst({
			where: and(
				eq(conversations.id, convId),
				eq(conversations.workspaceId, wsId),
			),
		});
		if (!conv) throw notFound("Conversation not found.");

		const conditions = [
			eq(messages.conversationId, convId),
			eq(messages.workspaceId, wsId),
		];

		if (request.query.cursor) {
			conditions.push(gt(messages.createdAt, new Date(request.query.cursor)));
		}
		if (request.query.since) {
			conditions.push(gt(messages.id, request.query.since));
		}

		const rows = await db.query.messages.findMany({
			where: and(...conditions),
			limit,
			orderBy: (m, { asc }) => [asc(m.createdAt)],
		});

		const nextCursor =
			rows.length === limit
				? rows[rows.length - 1].createdAt?.toISOString()
				: null;

		return {
			data: rows,
			page: { limit, next_cursor: nextCursor, has_more: rows.length === limit },
		};
	});

	app.post<{
		Params: { id: string };
		Body: {
			type?: string;
			body: string;
			sender_type?: string;
			sender_user_id?: string;
			sender_contact_id?: string;
			reply_to_id?: string;
		};
	}>("/v1/conversations/:id/messages", async (request, reply) => {
		const wsId = getWorkspaceId(request);
		const convId = request.params.id;
		const {
			type,
			body,
			sender_type,
			sender_user_id,
			sender_contact_id,
			reply_to_id,
		} = request.body ?? {};

		if (!body) throw validationError("body is required.", "body");

		const conv = await db.query.conversations.findFirst({
			where: and(
				eq(conversations.id, convId),
				eq(conversations.workspaceId, wsId),
			),
		});
		if (!conv) throw notFound("Conversation not found.");

		const [msg] = await db
			.insert(messages)
			.values({
				workspaceId: wsId,
				conversationId: convId,
				senderType: (sender_type as "agent") ?? "agent",
				senderUserId: sender_user_id,
				senderContactId: sender_contact_id,
				type: (type as "text") ?? "text",
				body,
				replyToId: reply_to_id,
			})
			.returning();

		await deliverNewMessage(msg, convId, wsId);

		if ((sender_type ?? "agent") === "contact") {
			triggerAIReply(wsId, convId, body, msg.id);
		}

		return reply.status(201).send(msg);
	});
}
