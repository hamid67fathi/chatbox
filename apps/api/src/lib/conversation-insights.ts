import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { aiInteractions, conversations, messages } from "../db/schema/index.js";
import {
	analyzeSentimentText,
	summarizeConversationText,
	type InsightMessage,
} from "./insights-client.js";
import { getIO } from "../ws/broadcast.js";

function toInsightRole(senderType: string): InsightMessage["role"] {
	if (senderType === "contact") return "contact";
	if (senderType === "ai") return "ai";
	if (senderType === "agent") return "agent";
	return "system";
}

function parseMessageSentiment(reactions: unknown): number | null {
	if (!reactions || typeof reactions !== "object") return null;
	const s = (reactions as { sentiment?: unknown }).sentiment;
	if (typeof s === "number") return s;
	if (typeof s === "string") {
		const n = Number.parseFloat(s);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function emitInsightsUpdated(
	workspaceId: string,
	conversationId: string,
	patch: { sentimentScore?: string | null; summary?: string | null },
) {
	try {
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("conv:insights_updated", {
			conversation_id: conversationId,
			sentiment_score: patch.sentimentScore ?? null,
			summary: patch.summary ?? null,
		});
	} catch {
		/* socket not ready */
	}
}

async function loadInsightMessages(
	workspaceId: string,
	conversationId: string,
): Promise<InsightMessage[]> {
	const rows = await db.query.messages.findMany({
		where: and(
			eq(messages.conversationId, conversationId),
			eq(messages.workspaceId, workspaceId),
		),
		orderBy: [asc(messages.createdAt)],
		limit: 50,
	});
	return rows
		.filter((m) => m.body?.trim())
		.map((m) => ({
			role: toInsightRole(m.senderType),
			content: m.body!.trim(),
		}));
}

async function recomputeConversationSentiment(
	workspaceId: string,
	conversationId: string,
) {
	const rows = await db.query.messages.findMany({
		where: and(
			eq(messages.conversationId, conversationId),
			eq(messages.workspaceId, workspaceId),
			eq(messages.senderType, "contact"),
		),
		orderBy: [asc(messages.createdAt)],
		limit: 20,
	});

	const scores: number[] = [];
	for (const row of rows) {
		const s = parseMessageSentiment(row.reactions);
		if (s != null) scores.push(s);
	}
	if (scores.length === 0) return null;

	const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
	const value = Math.max(-1, Math.min(1, avg)).toFixed(2);
	await db
		.update(conversations)
		.set({ sentimentScore: value, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));
	return value;
}

export async function analyzeContactMessageSentiment(
	workspaceId: string,
	conversationId: string,
	messageId: string,
	body: string,
) {
	const score = await analyzeSentimentText(body);
	if (score == null) return;

	await db
		.update(messages)
		.set({ reactions: { sentiment: score } })
		.where(
			and(
				eq(messages.id, messageId),
				eq(messages.workspaceId, workspaceId),
			),
		);

	const agg = await recomputeConversationSentiment(workspaceId, conversationId);
	if (agg != null) {
		emitInsightsUpdated(workspaceId, conversationId, {
			sentimentScore: agg,
		});
	}
}

export async function refreshConversationSummary(
	workspaceId: string,
	conversationId: string,
	trigger: "handoff" | "reopen" | "manual",
	agentUserId?: string,
): Promise<string | null> {
	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			eq(conversations.workspaceId, workspaceId),
		),
		with: { contact: true },
	});
	if (!conv) return null;

	const insightMessages = await loadInsightMessages(workspaceId, conversationId);
	if (insightMessages.length === 0) return null;

	const result = await summarizeConversationText(
		workspaceId,
		insightMessages,
		conv.contact?.fullName ?? null,
		conversationId,
	);
	if (!result?.summary) return null;

	const metadata = {
		...(typeof conv.metadata === "object" && conv.metadata
			? (conv.metadata as Record<string, unknown>)
			: {}),
		summary: result.summary,
		summary_updated_at: new Date().toISOString(),
		summary_trigger: trigger,
	};

	await db
		.update(conversations)
		.set({ metadata, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));

	await db.insert(aiInteractions).values({
		workspaceId,
		conversationId,
		purpose: "summary",
		model: result.model,
		prompt: agentUserId ? `agent:${agentUserId}` : trigger,
		response: result.summary,
		inputTokens: result.input_tokens,
		outputTokens: result.output_tokens,
		escalated: false,
	});

	emitInsightsUpdated(workspaceId, conversationId, {
		summary: result.summary,
	});

	return result.summary;
}

export function triggerContactMessageSentiment(
	workspaceId: string,
	conversationId: string,
	messageId: string,
	body: string,
) {
	void analyzeContactMessageSentiment(
		workspaceId,
		conversationId,
		messageId,
		body,
	);
}

export function triggerConversationSummary(
	workspaceId: string,
	conversationId: string,
	trigger: "handoff" | "reopen" | "manual",
	agentUserId?: string,
) {
	void refreshConversationSummary(
		workspaceId,
		conversationId,
		trigger,
		agentUserId,
	);
}
