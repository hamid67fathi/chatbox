import type { InsightMessage } from "./insights-client.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

export interface HandoffBrief {
	summary: string;
	key_points: string[];
	suggested_reply: string;
	generated_at: string;
	context?: {
		channel?: string;
		contact_name?: string | null;
		tags?: string[];
		subject?: string | null;
	};
}

export interface HandoffBriefAiResult {
	summary: string;
	key_points: string[];
	suggested_reply: string;
	model: string;
	input_tokens: number;
	output_tokens: number;
}

export function parseHandoffBrief(metadata: unknown): HandoffBrief | null {
	if (!metadata || typeof metadata !== "object") return null;
	const raw = (metadata as Record<string, unknown>).handoff_brief;
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	if (typeof o.summary !== "string" || !o.summary.trim()) return null;
	const key_points = Array.isArray(o.key_points)
		? o.key_points.filter((p): p is string => typeof p === "string")
		: [];
	const suggested =
		typeof o.suggested_reply === "string" ? o.suggested_reply : "";
	return {
		summary: o.summary,
		key_points,
		suggested_reply: suggested,
		generated_at:
			typeof o.generated_at === "string"
				? o.generated_at
				: new Date().toISOString(),
		context:
			o.context && typeof o.context === "object"
				? (o.context as HandoffBrief["context"])
				: undefined,
	};
}

export async function requestHandoffBrief(
	workspaceId: string,
	messages: InsightMessage[],
	opts: {
		contactName?: string | null;
		conversationId?: string;
		channel?: string;
		subject?: string | null;
		tags?: string[];
	},
): Promise<HandoffBriefAiResult | null> {
	if (messages.length === 0) return null;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/handoff-brief`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				messages,
				contact_name: opts.contactName ?? null,
				conversation_id: opts.conversationId ?? null,
				context: {
					channel: opts.channel ?? "widget",
					subject: opts.subject ?? null,
					tags: opts.tags ?? [],
				},
			}),
			signal: controller.signal,
		});
		if (!res.ok) return null;
		return (await res.json()) as HandoffBriefAiResult;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
