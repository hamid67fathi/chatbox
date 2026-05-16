const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

export interface CopilotMessage {
	role: "contact" | "agent" | "ai" | "system";
	content: string;
}

export interface CopilotSuggestion {
	style: string;
	label: string;
	text: string;
}

export interface CopilotResult {
	suggestions: CopilotSuggestion[];
	model: string;
	input_tokens: number;
	output_tokens: number;
}

export async function requestCopilot(
	workspaceId: string,
	messages: CopilotMessage[],
	contactName?: string | null,
	conversationId?: string,
): Promise<CopilotResult | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/copilot`, {
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
		if (!res.ok) {
			throw new Error(`AI copilot returned ${res.status}`);
		}
		return (await res.json()) as CopilotResult;
	} catch (err) {
		console.error("[AI] copilot failed:", (err as Error).message);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export async function streamCopilotFromAI(
	workspaceId: string,
	messages: CopilotMessage[],
	contactName: string | null | undefined,
	conversationId: string | undefined,
	onEvent: (event: Record<string, unknown>) => void,
	signal?: AbortSignal,
): Promise<boolean> {
	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/copilot/stream`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				messages,
				contact_name: contactName ?? null,
				conversation_id: conversationId ?? null,
			}),
			signal,
		});
		if (!res.ok || !res.body) return false;

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split("\n\n");
			buffer = parts.pop() ?? "";
			for (const part of parts) {
				for (const line of part.split("\n")) {
					if (!line.startsWith("data: ")) continue;
					try {
						onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
					} catch {
						/* ignore malformed */
					}
				}
			}
		}
		return true;
	} catch (err) {
		if ((err as Error).name !== "AbortError") {
			console.error("[AI] copilot stream failed:", (err as Error).message);
		}
		return false;
	}
}
