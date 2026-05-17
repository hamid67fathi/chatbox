import { randomUUID } from "node:crypto";

export interface TelegramIntegrationConfig {
	enabled: boolean;
	bot_token: string;
	bot_id: number;
	bot_username: string;
	webhook_secret: string;
	connected_at: string;
}

export interface TelegramIntegrationPublic {
	type: "telegram";
	enabled: boolean;
	bot_id: number;
	bot_username: string;
	connected_at: string;
	webhook_url: string;
	token_masked: string;
}

function integrationsRoot(settings: unknown): Record<string, unknown> {
	if (!settings || typeof settings !== "object") return {};
	const root = settings as Record<string, unknown>;
	const integrations = root.integrations;
	if (!integrations || typeof integrations !== "object") return {};
	return integrations as Record<string, unknown>;
}

export function parseTelegramIntegration(
	settings: unknown,
): TelegramIntegrationConfig | null {
	const tg = integrationsRoot(settings).telegram;
	if (!tg || typeof tg !== "object") return null;
	const o = tg as Record<string, unknown>;
	const botToken =
		typeof o.bot_token === "string" && o.bot_token.trim()
			? o.bot_token.trim()
			: "";
	if (!botToken) return null;

	const botId =
		typeof o.bot_id === "number"
			? o.bot_id
			: typeof o.bot_id === "string"
				? Number(o.bot_id)
				: NaN;
	const botUsername =
		typeof o.bot_username === "string" ? o.bot_username.replace(/^@/, "") : "";

	const webhookSecret =
		typeof o.webhook_secret === "string" && o.webhook_secret.trim()
			? o.webhook_secret.trim()
			: "";

	if (!Number.isFinite(botId) || !botUsername || !webhookSecret) return null;

	return {
		enabled: o.enabled !== false,
		bot_token: botToken,
		bot_id: botId,
		bot_username: botUsername,
		webhook_secret: webhookSecret,
		connected_at:
			typeof o.connected_at === "string"
				? o.connected_at
				: new Date().toISOString(),
	};
}

export function maskBotToken(token: string): string {
	if (token.length <= 12) return "••••••••";
	return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export function telegramWebhookUrl(workspaceId: string): string {
	const base = getApiPublicBaseUrl();
	return `${base}/v1/integrations/telegram/webhook/${workspaceId}`;
}

export function getApiPublicBaseUrl(): string {
	const raw =
		process.env.API_PUBLIC_URL ??
		process.env.PUBLIC_API_URL ??
		`http://localhost:${process.env.PORT ?? 3001}`;
	return raw.replace(/\/$/, "");
}

export function toPublicTelegramIntegration(
	config: TelegramIntegrationConfig,
	workspaceId: string,
): TelegramIntegrationPublic {
	return {
		type: "telegram",
		enabled: config.enabled,
		bot_id: config.bot_id,
		bot_username: config.bot_username,
		connected_at: config.connected_at,
		webhook_url: telegramWebhookUrl(workspaceId),
		token_masked: maskBotToken(config.bot_token),
	};
}

export function mergeTelegramIntegration(
	settings: unknown,
	config: TelegramIntegrationConfig | null,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const integrations =
		base.integrations && typeof base.integrations === "object"
			? { ...(base.integrations as Record<string, unknown>) }
			: {};

	if (!config) {
		const { telegram: _removed, ...rest } = integrations;
		if (Object.keys(rest).length === 0) {
			const { integrations: _i, ...top } = base;
			return top;
		}
		return { ...base, integrations: rest };
	}

	return {
		...base,
		integrations: {
			...integrations,
			telegram: config,
		},
	};
}

export function newWebhookSecret(): string {
	return randomUUID().replace(/-/g, "");
}
