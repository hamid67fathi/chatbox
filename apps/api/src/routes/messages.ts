import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { aiInteractions, conversations, messages } from "../db/schema/index.js";
import { askAI } from "../lib/ai-client.js";
import { notFound, validationError } from "../lib/errors.js";
import { getWorkspaceId } from "../lib/workspace.js";
import { getIO } from "../ws/broadcast.js";

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

		try {
			const io = getIO();
			const payload = { message: msg, conversation: { id: convId } };
			io.to(`conversation:${convId}`).emit("message:new", payload);
			io.to(`workspace:${wsId}`).emit("message:new", payload);
		} catch {
			/* socket.io not yet initialized during tests */
		}

		if ((sender_type ?? "agent") === "contact") {
			triggerAIReply(wsId, convId, body, msg.id).catch(() => {});
		}

		return reply.status(201).send(msg);
	});
}

async function triggerAIReply(
	workspaceId: string,
	conversationId: string,
	question: string,
	sourceMessageId: string,
) {
	const start = Date.now();
	const aiResult = await askAI(workspaceId, question, conversationId);
	const latencyMs = Date.now() - start;

	if (!aiResult) return;

	if (aiResult.handoff) {
		await db
			.update(conversations)
			.set({ aiHandled: false })
			.where(eq(conversations.id, conversationId));

		await db.insert(aiInteractions).values({
			workspaceId,
			conversationId,
			messageId: sourceMessageId,
			purpose: "auto_reply",
			model: aiResult.model,
			response: aiResult.reply,
			retrievedChunks: aiResult.retrieved_chunks,
			inputTokens: aiResult.input_tokens,
			outputTokens: aiResult.output_tokens,
			confidence: String(aiResult.confidence),
			escalated: true,
			latencyMs,
		});

		try {
			const io = getIO();
			io.to(`workspace:${workspaceId}`).emit("conv:needs_human", {
				conversation_id: conversationId,
			});
		} catch {}
		return;
	}

	const [aiMsg] = await db
		.insert(messages)
		.values({
			workspaceId,
			conversationId,
			senderType: "ai",
			type: "ai_reply",
			body: aiResult.reply,
			aiConfidence: String(aiResult.confidence),
			aiModel: aiResult.model,
		})
		.returning();

	await db.insert(aiInteractions).values({
		workspaceId,
		conversationId,
		messageId: aiMsg.id,
		purpose: "auto_reply",
		model: aiResult.model,
		prompt: question,
		response: aiResult.reply,
		retrievedChunks: aiResult.retrieved_chunks,
		inputTokens: aiResult.input_tokens,
		outputTokens: aiResult.output_tokens,
		confidence: String(aiResult.confidence),
		escalated: false,
		latencyMs,
	});

	try {
		const io = getIO();
		const payload = { message: aiMsg, conversation: { id: conversationId } };
		io.to(`conversation:${conversationId}`).emit("message:new", payload);
		io.to(`workspace:${workspaceId}`).emit("message:new", payload);
	} catch {}
}
