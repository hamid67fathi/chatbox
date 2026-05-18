import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	aiInteractions,
	conversationTags,
	conversations,
	messages,
	workspaces,
} from "../db/schema/index.js";
import { requestConversationTags } from "./ai-tag-client.js";
import {
	type AutoTagSettings,
	parseAutoTagSettings,
} from "./auto-tag-settings.js";
import { getAiBudgetStatus, estimateCostUsd, notifyAiBudgetIfNeeded } from "./ai-budget.js";
import type { InsightMessage } from "./insights-client.js";
import { getIO } from "../ws/broadcast.js";

export interface AiTaggingMeta {
	tags: string[];
	suggested_at: string;
	applied_at: string | null;
	model: string;
}

function toInsightRole(senderType: string): InsightMessage["role"] {
	if (senderType === "contact") return "contact";
	if (senderType === "ai") return "ai";
	if (senderType === "agent") return "agent";
	return "system";
}

export function normalizeTag(raw: string): string | null {
	const t = raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	if (!t || t.length > 48) return null;
	return t;
}

export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of tags) {
		const t = normalizeTag(raw);
		if (t && !seen.has(t)) {
			seen.add(t);
			out.push(t);
		}
	}
	return out.slice(0, 5);
}

export async function getAutoTagSettings(
	workspaceId: string,
): Promise<AutoTagSettings> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	return parseAutoTagSettings(ws?.settings);
}

async function loadMessages(
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

function parseAiTaggingMeta(metadata: unknown): AiTaggingMeta | null {
	if (!metadata || typeof metadata !== "object") return null;
	const raw = (metadata as Record<string, unknown>).ai_tagging;
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const tags = Array.isArray(o.tags)
		? o.tags.filter((t): t is string => typeof t === "string")
		: [];
	return {
		tags,
		suggested_at:
			typeof o.suggested_at === "string" ? o.suggested_at : "",
		applied_at:
			typeof o.applied_at === "string" ? o.applied_at : null,
		model: typeof o.model === "string" ? o.model : "unknown",
	};
}

function emitAutoTags(
	workspaceId: string,
	conversationId: string,
	tags: string[],
	applied: string[],
) {
	try {
		const io = getIO();
		io.to(`workspace:${workspaceId}`)
			.to(`conversation:${conversationId}`)
			.emit("conv:auto_tags", {
				conversation_id: conversationId,
				suggested_tags: tags,
				applied_tags: applied,
			});
	} catch {
		/* socket not ready */
	}
}

export interface AutoTagRunResult {
	ok: boolean;
	tags: string[];
	applied: string[];
	model?: string;
	skipped?: string;
}

export async function runAutoTagging(
	workspaceId: string,
	conversationId: string,
	opts?: { force?: boolean; apply?: boolean },
): Promise<AutoTagRunResult> {
	const settings = await getAutoTagSettings(workspaceId);
	if (!settings.enabled && !opts?.force) {
		return { ok: false, tags: [], applied: [], skipped: "disabled" };
	}

	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			eq(conversations.workspaceId, workspaceId),
		),
		with: { contact: true, tags: true },
	});
	if (!conv) {
		return { ok: false, tags: [], applied: [], skipped: "not_found" };
	}

	const existingMeta = parseAiTaggingMeta(conv.metadata);
	if (existingMeta?.applied_at && !opts?.force) {
		return {
			ok: true,
			tags: existingMeta.tags,
			applied: conv.tags.map((t) => t.tag),
			skipped: "already_applied",
		};
	}

	const insightMessages = await loadMessages(workspaceId, conversationId);
	if (insightMessages.length === 0) {
		return { ok: false, tags: [], applied: [], skipped: "no_messages" };
	}

	const budget = await getAiBudgetStatus(workspaceId);
	if (budget && !budget.allowAi) {
		return { ok: false, tags: [], applied: [], skipped: "ai_budget" };
	}

	const existingTags = conv.tags.map((t) => t.tag);
	const aiResult = await requestConversationTags(
		workspaceId,
		insightMessages,
		{
			contactName: conv.contact?.fullName ?? null,
			conversationId,
			existingTags,
		},
	);
	if (!aiResult) {
		return { ok: false, tags: [], applied: [], skipped: "ai_unavailable" };
	}

	const suggested = normalizeTags(aiResult.tags);
	const shouldApply = opts?.apply ?? settings.auto_apply;
	const applied: string[] = [];

	if (shouldApply && suggested.length > 0) {
		await db
			.insert(conversationTags)
			.values(
				suggested.map((tag) => ({
					conversationId,
					tag,
				})),
			)
			.onConflictDoNothing();
		applied.push(...suggested);
	}

	const aiTagging: AiTaggingMeta = {
		tags: suggested,
		suggested_at: new Date().toISOString(),
		applied_at: shouldApply && suggested.length > 0 ? new Date().toISOString() : null,
		model: aiResult.model,
	};

	const metadata = {
		...(typeof conv.metadata === "object" && conv.metadata
			? (conv.metadata as Record<string, unknown>)
			: {}),
		ai_tagging: aiTagging,
	};

	await db
		.update(conversations)
		.set({ metadata, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));

	await db.insert(aiInteractions).values({
		workspaceId,
		conversationId,
		purpose: "tag",
		model: aiResult.model,
		prompt: JSON.stringify({ existing_tags: existingTags }),
		response: JSON.stringify({ tags: suggested, applied }),
		inputTokens: aiResult.input_tokens,
		outputTokens: aiResult.output_tokens,
		costUsd: estimateCostUsd(
			aiResult.model,
			aiResult.input_tokens,
			aiResult.output_tokens,
		),
		escalated: false,
	});
	await notifyAiBudgetIfNeeded(workspaceId);

	emitAutoTags(workspaceId, conversationId, suggested, applied);

	return {
		ok: true,
		tags: suggested,
		applied,
		model: aiResult.model,
	};
}

export function triggerAutoTagging(
	workspaceId: string,
	conversationId: string,
) {
	void runAutoTagging(workspaceId, conversationId);
}
