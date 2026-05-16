import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { conversations, messages } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
	assertConversationAccess,
	claimConversationForAgent,
} from "../lib/conversation-access.js";
import { validateMessagePayload } from "../lib/attachments.js";
import {
	deliverNewMessage,
	triggerAIReply,
} from "../lib/message-delivery.js";
import { notFound } from "../lib/errors.js";
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

		const user = (request as AuthenticatedRequest).user;
		await assertConversationAccess(conv, wsId, user.id);

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
			body?: string;
			attachments?: unknown;
			sender_type?: string;
			sender_user_id?: string;
			sender_contact_id?: string;
			reply_to_id?: string;
		};
	}>("/v1/conversations/:id/messages", async (request, reply) => {
		const wsId = getWorkspaceId(request);
		const convId = request.params.id;
		const {
			body,
			attachments,
			sender_type,
			sender_user_id,
			sender_contact_id,
			reply_to_id,
		} = request.body ?? {};

		const payload = validateMessagePayload({ body, type, attachments });

		const conv = await db.query.conversations.findFirst({
			where: and(
				eq(conversations.id, convId),
				eq(conversations.workspaceId, wsId),
			),
		});
		if (!conv) throw notFound("Conversation not found.");

		const user = (request as AuthenticatedRequest).user;
		await assertConversationAccess(conv, wsId, user.id);

		const effectiveSender = (sender_type as "agent") ?? "agent";

		const [msg] = await db
			.insert(messages)
			.values({
				workspaceId: wsId,
				conversationId: convId,
				senderType: effectiveSender,
				senderUserId:
					effectiveSender === "agent" ? (sender_user_id ?? user.id) : sender_user_id,
				senderContactId: sender_contact_id,
				type: payload.type,
				body: payload.body,
				attachments: payload.attachments,
				replyToId: reply_to_id,
			})
			.returning();

		if (effectiveSender === "agent") {
			await claimConversationForAgent(convId, wsId, user.id);
		}

		await deliverNewMessage(msg, convId, wsId);

		if ((sender_type ?? "agent") === "contact" && payload.type === "text") {
			triggerAIReply(wsId, convId, payload.body, msg.id);
		}

		return reply.status(201).send(msg);
	});
}
