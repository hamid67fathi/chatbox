import { assertAiBudgetAllowed } from "./ai-budget.js";
import { ApiError } from "./errors.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 10_000);

interface AskResponse {
	reply: string;
	confidence: number;
	handoff: boolean;
	model: string;
	intent?: string;
	route?: string;
	intent_confidence?: number;
	language?: string;
	language_confidence?: number;
	retrieved_chunks: Array<{ chunk_id: string; score: number }>;
	input_tokens: number;
	output_tokens: number;
}

let circuitOpen = false;
let circuitResetAt = 0;
let consecutiveFailures = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30_000;

export async function askAI(
	workspaceId: string,
	question: string,
	conversationId?: string,
	defaultLanguage?: string,
	aiPersona?: Record<string, unknown> | null,
): Promise<AskResponse | null> {
	try {
		await assertAiBudgetAllowed(workspaceId);
	} catch (err) {
		if (err instanceof ApiError && err.statusCode === 402) {
			console.warn("[AI] budget exhausted for workspace", workspaceId);
		}
		return null;
	}

	if (circuitOpen) {
		if (Date.now() < circuitResetAt) return null;
		circuitOpen = false;
		consecutiveFailures = 0;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/ask`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				question,
				conversation_id: conversationId,
				default_language: defaultLanguage,
				ai_persona: aiPersona ?? undefined,
			}),
			signal: controller.signal,
		});

		if (!res.ok) {
			throw new Error(`AI service returned ${res.status}`);
		}

		consecutiveFailures = 0;
		return (await res.json()) as AskResponse;
	} catch (err) {
		consecutiveFailures++;
		if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
			circuitOpen = true;
			circuitResetAt = Date.now() + CIRCUIT_COOLDOWN_MS;
		}
		console.error("[AI] ask failed:", (err as Error).message);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
