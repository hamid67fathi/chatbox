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
	emailConfigFromInput,
	mergeEmailIntegration,
	parseEmailIntegration,
	toPublicEmailIntegration,
	type EmailConnectInput,
} from "../lib/email-settings.js";
import {
	mergeTelegramIntegration,
	newWebhookSecret,
	parseTelegramIntegration,
	telegramWebhookUrl,
	toPublicTelegramIntegration,
	type TelegramIntegrationConfig,
} from "../lib/telegram-settings.js";
import { verifyImapConnection, verifySmtpConnection } from "../channels/email/verify.js";
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
			const email = parseEmailIntegration(ws.settings);
			const data = [];
			if (telegram) data.push(toPublicTelegramIntegration(telegram, wsId));
			if (email) data.push(toPublicEmailIntegration(email));

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

	app.post<{
		Body: {
			imap_host?: string;
			imap_port?: number;
			imap_secure?: boolean;
			imap_user?: string;
			imap_password?: string;
			smtp_host?: string;
			smtp_port?: number;
			smtp_secure?: boolean;
			smtp_user?: string;
			smtp_password?: string;
			from_address?: string;
			from_name?: string | null;
		};
	}>(
		"/v1/integrations/email",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			await assertIntegrationsAdmin(request, wsId);

			const b = request.body ?? {};
			const input: EmailConnectInput = {
				imap_host: String(b.imap_host ?? "").trim(),
				imap_port: Number(b.imap_port ?? 993),
				imap_secure: b.imap_secure !== false,
				imap_user: String(b.imap_user ?? "").trim(),
				imap_password: String(b.imap_password ?? ""),
				smtp_host: String(b.smtp_host ?? "").trim(),
				smtp_port: Number(b.smtp_port ?? 587),
				smtp_secure: b.smtp_secure === true,
				smtp_user: String(b.smtp_user ?? "").trim(),
				smtp_password: String(b.smtp_password ?? ""),
				from_address: String(b.from_address ?? "").trim(),
				from_name:
					typeof b.from_name === "string" ? b.from_name.trim() : null,
			};

			if (!input.imap_host || !input.imap_user || !input.imap_password) {
				throw validationError("IMAP settings are incomplete.", "imap_host");
			}
			if (!input.smtp_host || !input.smtp_user || !input.smtp_password) {
				throw validationError("SMTP settings are incomplete.", "smtp_host");
			}
			if (!input.from_address) {
				throw validationError("from_address is required.", "from_address");
			}

			const config = emailConfigFromInput(input);
			await verifyImapConnection(config.imap);
			await verifySmtpConnection(config.smtp, config.from_address);

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const existing = parseEmailIntegration(ws.settings);
			if (existing) {
				config.imap_last_uid = existing.imap_last_uid;
			}

			const nextSettings = mergeEmailIntegration(ws.settings, config);
			await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId));

			return { data: toPublicEmailIntegration(config) };
		},
	);

	app.post(
		"/v1/integrations/email/test",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			await assertIntegrationsAdmin(request, wsId);

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const config = parseEmailIntegration(ws.settings);
			if (!config) {
				throw validationError("Email integration is not configured.", "email");
			}

			await verifyImapConnection(config.imap);
			await verifySmtpConnection(config.smtp, config.from_address);

			return { ok: true };
		},
	);

	app.delete(
		"/v1/integrations/email",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			await assertIntegrationsAdmin(request, wsId);

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const nextSettings = mergeEmailIntegration(ws.settings, null);
			await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId));

			return { ok: true };
		},
	);
}
