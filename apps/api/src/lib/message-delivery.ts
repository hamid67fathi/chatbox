import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	aiInteractions,
	conversations,
	messages,
	type contacts,
} from "../db/schema/index.js";
import { askAI } from "./ai-client.js";
import {
	estimateCostUsd,
	getAiBudgetStatus,
	notifyAiBudgetIfNeeded,
} from "./ai-budget.js";
import {
	triggerContactMessageSentiment,
	triggerConversationSummary,
} from "./conversation-insights.js";
import { deliverOutboundToTelegram } from "../channels/telegram/outbound.js";
import { getIO } from "../ws/broadcast.js";

export function broadcastNewConversation(
	conversation: typeof conversations.$inferSelect,
	contact: typeof contacts.$inferSelect,
) {
	try {
		const io = getIO();
		io.to(`workspace:${conversation.workspaceId}`).emit("conversation:new", {
			conversation: {
				...conversation,
				contact: {
					id: contact.id,
					fullName: contact.fullName,
					email: contact.email,
				},
			},
		});
	} catch {
		/* socket.io not yet initialized */
	}
}

/** Updates conversation timestamps (fallback when DB trigger is missing). */
export async function touchConversationOnMessage(
	conversationId: string,
	message: typeof messages.$inferSelect,
) {
	const at = message.createdAt ?? new Date();
	await db
		.update(conversations)
		.set({
			lastMessageAt: at,
			updatedAt: new Date(),
			...(message.senderType === "agent"
				? { lastAgentReplyAt: at }
				: {}),
		})
		.where(eq(conversations.id, conversationId));
}

export async function deliverNewMessage(
	message: typeof messages.$inferSelect,
	conversationId: string,
	workspaceId: string,
) {
	await touchConversationOnMessage(conversationId, message);
	const now = new Date();
	const [delivered] = await db
		.update(messages)
		.set({ deliveredAt: now, status: "delivered" })
		.where(eq(messages.id, message.id))
		.returning();
	await broadcastNewMessage(delivered ?? message, conversationId, workspaceId);

	const published = delivered ?? message;
	if (published.senderType === "contact" && published.body?.trim()) {
		triggerContactMessageSentiment(
			workspaceId,
			conversationId,
			published.id,
			published.body,
		);
	}

	void deliverOutboundToTelegram(published, conversationId, workspaceId);
}

export async function broadcastNewMessage(
	message: typeof messages.$inferSelect,
	conversationId: string,
	workspaceId: string,
) {
	try {
		const io = getIO();
		const conv = await db.query.conversations.findFirst({
			where: eq(conversations.id, conversationId),
			columns: {
				id: true,
				assignedAgentId: true,
				lastAgentReplyAt: true,
			},
		});
		const payload = {
			message,
			conversation: {
				id: conversationId,
				assignedAgentId: conv?.assignedAgentId ?? null,
				lastAgentReplyAt: conv?.lastAgentReplyAt?.toISOString() ?? null,
			},
		};
		io.to(`conversation:${conversationId}`).emit("message:new", payload);
		io.to(`workspace:${workspaceId}`).emit("message:new", payload);
	} catch {
		/* socket.io not yet initialized */
	}
}

function aiPurpose(aiResult: {
	intent?: string;
	route?: string;
}): string {
	const intent = aiResult.intent ?? "faq";
	const route = aiResult.route ?? "rag";
	return `auto_reply:${intent}:${route}`;
}

export function triggerAIReply(
	workspaceId: string,
	conversationId: string,
	question: string,
	sourceMessageId: string,
) {
	void runAIReply(workspaceId, conversationId, question, sourceMessageId);
}

async function escalateBudgetExhausted(
	workspaceId: string,
	conversationId: string,
	sourceMessageId: string,
) {
	await db
		.update(conversations)
		.set({ aiHandled: false })
		.where(eq(conversations.id, conversationId));

	await db.insert(aiInteractions).values({
		workspaceId,
		conversationId,
		messageId: sourceMessageId,
		purpose: "auto_reply:budget_exhausted",
		model: "budget:blocked",
		response: null,
		escalated: true,
	});

	try {
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("conv:needs_human", {
			conversation_id: conversationId,
			reason: "ai_budget_exhausted",
		});
	} catch {}
}

async function runAIReply(
	workspaceId: string,
	conversationId: string,
	question: string,
	sourceMessageId: string,
) {
	const budget = await getAiBudgetStatus(workspaceId);
	if (budget && !budget.allowAi) {
		await escalateBudgetExhausted(workspaceId, conversationId, sourceMessageId);
		return;
	}

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
			purpose: aiPurpose(aiResult),
			model: aiResult.model,
			response: aiResult.reply,
			retrievedChunks: aiResult.retrieved_chunks,
			inputTokens: aiResult.input_tokens,
			outputTokens: aiResult.output_tokens,
			costUsd: estimateCostUsd(
				aiResult.model,
				aiResult.input_tokens,
				aiResult.output_tokens,
			),
			confidence: String(aiResult.confidence),
			escalated: true,
			latencyMs,
		});
		await notifyAiBudgetIfNeeded(workspaceId);

		try {
			const io = getIO();
			io.to(`workspace:${workspaceId}`).emit("conv:needs_human", {
				conversation_id: conversationId,
			});
		} catch {}

		triggerConversationSummary(workspaceId, conversationId, "handoff");
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
		purpose: aiPurpose(aiResult),
		model: aiResult.model,
		prompt: question,
		response: aiResult.reply,
		retrievedChunks: aiResult.retrieved_chunks,
		inputTokens: aiResult.input_tokens,
		outputTokens: aiResult.output_tokens,
		costUsd: estimateCostUsd(
			aiResult.model,
			aiResult.input_tokens,
			aiResult.output_tokens,
		),
		confidence: String(aiResult.confidence),
		escalated: false,
		latencyMs,
	});
	await notifyAiBudgetIfNeeded(workspaceId);

	await deliverNewMessage(aiMsg, conversationId, workspaceId);
}
