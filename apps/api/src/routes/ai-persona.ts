import type { FastifyInstance } from "fastify";
import {
	aiPersonaForAiService,
	aiPersonaToPublic,
	getWorkspaceAiPersona,
	parseAiPersona,
	updateWorkspaceAiPersona,
	type AiPersonaTone,
} from "../lib/ai-persona.js";
import { getWorkspaceAiLanguage } from "../lib/ai-language-settings.js";
import { validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

export async function aiPersonaRoutes(app: FastifyInstance) {
	app.get(
		"/v1/ai-persona",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const persona = await getWorkspaceAiPersona(wsId);
			return { data: aiPersonaToPublic(persona) };
		},
	);

	app.patch<{
		Body: {
			enabled?: boolean;
			name?: string | null;
			tone?: AiPersonaTone;
			custom_instructions?: string;
		};
	}>(
		"/v1/ai-persona",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const patch: Partial<ReturnType<typeof parseAiPersona>> = {};
			if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
			if (body.name !== undefined) {
				patch.name =
					typeof body.name === "string" && body.name.trim()
						? body.name.trim().slice(0, 80)
						: null;
			}
			if (body.tone === "formal" || body.tone === "friendly" || body.tone === "technical") {
				patch.tone = body.tone;
			}
			if (typeof body.custom_instructions === "string") {
				patch.custom_instructions = body.custom_instructions.slice(0, 2000);
			}
			if (Object.keys(patch).length === 0) {
				throw validationError("No valid fields to update.", "enabled");
			}
			const persona = await updateWorkspaceAiPersona(wsId, patch);
			return { data: aiPersonaToPublic(persona) };
		},
	);

	app.post<{
		Body: {
			question?: string;
			persona?: {
				enabled?: boolean;
				name?: string | null;
				tone?: AiPersonaTone;
				custom_instructions?: string;
			};
		};
	}>(
		"/v1/ai/persona/preview",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const question =
				typeof request.body?.question === "string" &&
				request.body.question.trim()
					? request.body.question.trim().slice(0, 500)
					: "سلام، چطور می‌توانم سفارش خود را پیگیری کنم؟";

			const base = await getWorkspaceAiPersona(wsId);
			const merged = request.body?.persona
				? parseAiPersona({ ...base, ...request.body.persona })
				: base;
			const langSettings = await getWorkspaceAiLanguage(wsId);
			const personaPayload = aiPersonaForAiService(merged);

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
			try {
				const res = await fetch(`${AI_SERVICE_URL}/v1/persona/preview`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						workspace_id: wsId,
						question,
						persona: personaPayload,
						default_language: langSettings.default_language,
					}),
					signal: controller.signal,
				});
				if (!res.ok) {
					return reply.status(502).send({
						error: {
							message:
								"سرویس AI در دسترس نیست. ai-service را روی پورت ۸۰۰۰ اجرا کنید.",
						},
					});
				}
				const json = (await res.json()) as {
					reply?: string;
					language?: string;
					model?: string;
				};
				return {
					data: {
						reply: json.reply ?? "",
						language: json.language ?? langSettings.default_language,
						model: json.model ?? "unknown",
					},
				};
			} catch {
				return reply.status(502).send({
					error: { message: "پیش‌نمایش persona ناموفق بود." },
				});
			} finally {
				clearTimeout(timeout);
			}
		},
	);
}
