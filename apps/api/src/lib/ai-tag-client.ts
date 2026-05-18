import type { InsightMessage } from "./insights-client.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

export interface AiTagResult {
	tags: string[];
	model: string;
	input_tokens: number;
	output_tokens: number;
}

export async function requestConversationTags(
	workspaceId: string,
	messages: InsightMessage[],
	opts?: {
		contactName?: string | null;
		conversationId?: string;
		existingTags?: string[];
	},
): Promise<AiTagResult | null> {
	if (messages.length === 0) return null;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/tag`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				messages,
				contact_name: opts?.contactName ?? null,
				conversation_id: opts?.conversationId ?? null,
				existing_tags: opts?.existingTags ?? [],
			}),
			signal: controller.signal,
		});
		if (!res.ok) return null;
		const data = (await res.json()) as AiTagResult;
		if (!Array.isArray(data.tags)) return null;
		return data;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
