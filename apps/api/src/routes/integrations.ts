import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { forbidden, unauthorized } from "../lib/auth.js";
import {
	telegramDeleteWebhook,
	telegramGetMe,
	telegramSetWebhook,
} from "../channels/telegram/api.js";
import {
	handleTelegramWebhook,
	type TelegramUpdate,
} from "../channels/telegram/inbound.js";
import { notFound, validationError } from "../lib/errors.js";
import {
	getWorkspaceRole,
	isSupervisorRole,
} from "../lib/conversation-access.js";
import {
	mergeTelegramIntegration,
	newWebhookSecret,
	parseTelegramIntegration,
	telegramWebhookUrl,
	toPublicTelegramIntegration,
	type TelegramIntegrationConfig,
} from "../lib/telegram-settings.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

async function assertIntegrationsAdmin(request: FastifyRequest, wsId: string) {
	const user = (request as AuthenticatedRequest).user;
	const role = await getWorkspaceRole(wsId, user.id);
	if (!role || !isSupervisorRole(role)) {
		throw forbidden("Only workspace admins can manage integrations.");
	}
}

export async function integrationsRoutes(app: FastifyInstance) {
	app.post<{ Params: { workspaceId: string }; Body: TelegramUpdate }>(
		"/v1/integrations/telegram/webhook/:workspaceId",
		{
			config: { rateLimit: { max: 200, timeWindow: "1 minute" } },
		},
		async (request, reply) => {
			const workspaceId = request.params.workspaceId;
			const secret = request.headers["x-telegram-bot-api-secret-token"];
			const secretHeader = Array.isArray(secret) ? secret[0] : secret;

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, workspaceId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const integration = parseTelegramIntegration(ws.settings);
			if (!integration?.enabled) {
				return reply.status(200).send({ ok: true });
			}
			if (secretHeader !== integration.webhook_secret) {
				throw unauthorized("Invalid Telegram webhook secret.");
			}

			await handleTelegramWebhook(workspaceId, request.body ?? {});
			return reply.status(200).send({ ok: true });
		},
	);
}

export async function integrationsProtectedRoutes(app: FastifyInstance) {
	app.get(
		"/v1/integrations",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const telegram = parseTelegramIntegration(ws.settings);
			const data = telegram
				? [toPublicTelegramIntegration(telegram, wsId)]
				: [];

			return { data };
		},
	);

	app.post<{ Body: { bot_token?: string } }>(
		"/v1/integrations/telegram",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			await assertIntegrationsAdmin(request, wsId);

			const botToken =
				typeof request.body?.bot_token === "string"
					? request.body.bot_token.trim()
					: "";
			if (!botToken) {
				throw validationError("bot_token is required.", "bot_token");
			}

			const me = await telegramGetMe(botToken);
			if (!me.is_bot) {
				throw validationError("Token is not a bot token.", "bot_token");
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const existing = parseTelegramIntegration(ws.settings);
			const webhookSecret = existing?.webhook_secret ?? newWebhookSecret();

			const config: TelegramIntegrationConfig = {
				enabled: true,
				bot_token: botToken,
				bot_id: me.id,
				bot_username: me.username ?? `bot${me.id}`,
				webhook_secret: webhookSecret,
				connected_at: new Date().toISOString(),
			};

			const webhookUrl = telegramWebhookUrl(wsId);
			await telegramSetWebhook(botToken, webhookUrl, webhookSecret);

			const nextSettings = mergeTelegramIntegration(ws.settings, config);
			await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId));

			return {
				data: toPublicTelegramIntegration(config, wsId),
				webhook_registered: true,
			};
		},
	);

	app.delete(
		"/v1/integrations/telegram",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			await assertIntegrationsAdmin(request, wsId);

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const existing = parseTelegramIntegration(ws.settings);
			if (existing?.bot_token) {
				try {
					await telegramDeleteWebhook(existing.bot_token);
				} catch {
					/* ignore cleanup errors */
				}
			}

			const nextSettings = mergeTelegramIntegration(ws.settings, null);
			await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId));

			return { ok: true };
		},
	);
}
