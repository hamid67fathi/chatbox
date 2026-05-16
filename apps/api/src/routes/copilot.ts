import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { aiInteractions, conversations, messages } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
	type CopilotMessage,
	requestCopilot,
	streamCopilotFromAI,
} from "../lib/copilot-client.js";
import { assertConversationAccess } from "../lib/conversation-access.js";
import { notFound } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

function toCopilotRole(senderType: string): CopilotMessage["role"] {
	if (senderType === "contact") return "contact";
	if (senderType === "ai") return "ai";
	if (senderType === "agent") return "agent";
	return "system";
}

async function loadCopilotContext(wsId: string, convId: string) {
	const conv = await db.query.conversations.findFirst({
		where: and(eq(conversations.id, convId), eq(conversations.workspaceId, wsId)),
		with: { contact: true },
	});
	if (!conv) throw notFound("Conversation not found.");

	const rows = await db.query.messages.findMany({
		where: and(
			eq(messages.conversationId, convId),
			eq(messages.workspaceId, wsId),
		),
		orderBy: [asc(messages.createdAt)],
		limit: 30,
	});

	const copilotMessages: CopilotMessage[] = rows
		.filter((m) => m.body?.trim())
		.map((m) => ({
			role: toCopilotRole(m.senderType),
			content: m.body!.trim(),
		}));

	return {
		conv,
		messages: copilotMessages,
		contactName: conv.contact?.fullName ?? null,
	};
}

async function logCopilotInteraction(
	wsId: string,
	convId: string,
	userId: string,
	result: { model: string; input_tokens: number; output_tokens: number },
) {
	await db.insert(aiInteractions).values({
		workspaceId: wsId,
		conversationId: convId,
		purpose: "copilot",
		model: result.model,
		prompt: `agent:${userId}`,
		response: null,
		inputTokens: result.input_tokens,
		outputTokens: result.output_tokens,
		escalated: false,
	});
}

export async function copilotRoutes(app: FastifyInstance) {
	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/copilot",
		{ preHandler: [requireWorkspace("agent")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const convId = request.params.id;
			const user = (request as AuthenticatedRequest).user;

			const { conv, messages: copilotMessages, contactName } =
				await loadCopilotContext(wsId, convId);
			await assertConversationAccess(conv, wsId, user.id);

			const result = await requestCopilot(
				wsId,
				copilotMessages,
				contactName,
				convId,
			);
			if (!result) {
				return reply.status(503).send({
					error: {
						code: "ai_unavailable",
						message: "سرویس پیشنهاد پاسخ در دسترس نیست.",
					},
				});
			}

			await logCopilotInteraction(wsId, convId, user.id, result);

			return { data: result };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/conversations/:id/copilot/stream",
		{ preHandler: [requireWorkspace("agent")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const convId = request.params.id;
			const user = (request as AuthenticatedRequest).user;

			const { conv, messages: copilotMessages, contactName } =
				await loadCopilotContext(wsId, convId);
			await assertConversationAccess(conv, wsId, user.id);

			reply.hijack();
			reply.raw.writeHead(200, {
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			});

			let tokens = { model: "stub", input_tokens: 0, output_tokens: 0 };

			const ok = await streamCopilotFromAI(
				wsId,
				copilotMessages,
				contactName,
				convId,
				(event) => {
					if (event.type === "meta" && event.model) {
						tokens.model = String(event.model);
					}
					if (event.type === "done") {
						tokens = {
							model: String(event.model ?? tokens.model),
							input_tokens: Number(event.input_tokens ?? 0),
							output_tokens: Number(event.output_tokens ?? 0),
						};
					}
					reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
				},
			);

			if (!ok) {
				reply.raw.write(
					`data: ${JSON.stringify({
						type: "error",
						message: "سرویس پیشنهاد پاسخ در دسترس نیست.",
					})}\n\n`,
				);
			}

			await logCopilotInteraction(wsId, convId, user.id, tokens);
			reply.raw.end();
		},
	);
}
