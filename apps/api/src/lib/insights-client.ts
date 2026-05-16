const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

export interface InsightMessage {
	role: "contact" | "agent" | "ai" | "system";
	content: string;
}

export async function analyzeSentimentText(text: string): Promise<number | null> {
	if (!text.trim()) return null;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/sentiment`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
			signal: controller.signal,
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { score?: number };
		return typeof data.score === "number" ? data.score : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export async function summarizeConversationText(
	workspaceId: string,
	messages: InsightMessage[],
	contactName?: string | null,
	conversationId?: string,
): Promise<{
	summary: string;
	model: string;
	input_tokens: number;
	output_tokens: number;
} | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/summarize`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				messages,
				contact_name: contactName ?? null,
				conversation_id: conversationId ?? null,
			}),
			signal: controller.signal,
		});
		if (!res.ok) return null;
		return (await res.json()) as {
			summary: string;
			model: string;
			input_tokens: number;
			output_tokens: number;
		};
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
