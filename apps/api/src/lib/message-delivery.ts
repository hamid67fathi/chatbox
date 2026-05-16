import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { aiInteractions, conversations, messages } from "../db/schema/index.js";
import { askAI } from "./ai-client.js";
import { getIO } from "../ws/broadcast.js";

export function broadcastNewMessage(
	message: typeof messages.$inferSelect,
	conversationId: string,
	workspaceId: string,
) {
	try {
		const io = getIO();
		const payload = { message, conversation: { id: conversationId } };
		io.to(`conversation:${conversationId}`).emit("message:new", payload);
		io.to(`workspace:${workspaceId}`).emit("message:new", payload);
	} catch {
		/* socket.io not yet initialized */
	}
}

export function triggerAIReply(
	workspaceId: string,
	conversationId: string,
	question: string,
	sourceMessageId: string,
) {
	void runAIReply(workspaceId, conversationId, question, sourceMessageId);
}

async function runAIReply(
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

	broadcastNewMessage(aiMsg, conversationId, workspaceId);
}
