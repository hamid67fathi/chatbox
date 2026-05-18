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

export type CopilotFailureReason =
	| "unreachable"
	| "bad_response"
	| "timeout"
	| "unknown";

export interface CopilotFailure {
	reason: CopilotFailureReason;
	message: string;
	status?: number;
}

const UNAVAILABLE_MSG = "سرویس پیشنهاد پاسخ در دسترس نیست.";
const AI_DOWN_MSG =
	"سرویس AI روشن نیست. ترمینال ai-service را اجرا کنید (پورت ۸۰۰۰) و AI_SERVICE_URL را در .env بررسی کنید.";

function messagesForAi(messages: CopilotMessage[]): CopilotMessage[] {
	if (messages.length > 0) return messages;
	return [
		{
			role: "system",
			content:
				"مکالمه هنوز متنی ندارد. سه پیشنهاد شروع گفتگوی مودبانه به فارسی بده.",
		},
	];
}

function failureFromError(err: unknown, status?: number): CopilotFailure {
	if (err instanceof Error && err.name === "AbortError") {
		return { reason: "timeout", message: "زمان انتظار سرویس AI تمام شد." };
	}
	const code = (err as NodeJS.ErrnoException)?.code;
	if (
		code === "ECONNREFUSED" ||
		code === "ENOTFOUND" ||
		code === "ECONNRESET" ||
		code === "EHOSTUNREACH"
	) {
		return { reason: "unreachable", message: AI_DOWN_MSG };
	}
	if (status === 400) {
		return {
			reason: "bad_response",
			message: "درخواست Copilot نامعتبر بود (مکالمه بدون متن).",
		};
	}
	if (status && status >= 500) {
		return {
			reason: "bad_response",
			message: "خطای داخلی سرویس AI. لاگ ai-service را بررسی کنید.",
		};
	}
	return { reason: "unknown", message: UNAVAILABLE_MSG, status };
}

export async function pingAiService(): Promise<boolean> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 4_000);
	try {
		const res = await fetch(`${AI_SERVICE_URL}/health`, {
			signal: controller.signal,
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

export async function requestCopilot(
	workspaceId: string,
	messages: CopilotMessage[],
	contactName?: string | null,
	conversationId?: string,
	aiPersona?: Record<string, unknown> | null,
): Promise<{ ok: true; data: CopilotResult } | { ok: false; failure: CopilotFailure }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
	const payload = messagesForAi(messages);

	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/copilot`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				messages: payload,
				contact_name: contactName ?? null,
				conversation_id: conversationId ?? null,
				ai_persona: aiPersona ?? undefined,
			}),
			signal: controller.signal,
		});
		if (!res.ok) {
			let detail = "";
			try {
				const body = (await res.json()) as { detail?: string };
				detail = body.detail ?? "";
			} catch {
				/* ignore */
			}
			console.error(
				"[AI] copilot failed:",
				res.status,
				detail || res.statusText,
			);
			return {
				ok: false,
				failure: failureFromError(new Error(detail || res.statusText), res.status),
			};
		}
		const data = (await res.json()) as CopilotResult;
		return { ok: true, data };
	} catch (err) {
		console.error("[AI] copilot failed:", (err as Error).message);
		return { ok: false, failure: failureFromError(err) };
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
	aiPersona?: Record<string, unknown> | null,
): Promise<{ ok: true } | { ok: false; failure: CopilotFailure }> {
	const payload = messagesForAi(messages);

	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/copilot/stream`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				messages: payload,
				contact_name: contactName ?? null,
				conversation_id: conversationId ?? null,
				ai_persona: aiPersona ?? undefined,
			}),
			signal,
		});
		if (!res.ok || !res.body) {
			return {
				ok: false,
				failure: failureFromError(
					new Error(res.statusText),
					res.status || undefined,
				),
			};
		}

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
		return { ok: true };
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			return { ok: false, failure: failureFromError(err) };
		}
		console.error("[AI] copilot stream failed:", (err as Error).message);
		return { ok: false, failure: failureFromError(err) };
	}
}

export function copilotUnavailableMessage(failure: CopilotFailure): string {
	return failure.message || UNAVAILABLE_MSG;
}
