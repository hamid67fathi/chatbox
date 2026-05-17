import { randomUUID } from "node:crypto";
import { getApiPublicBaseUrl } from "./telegram-settings.js";

export interface WhatsappIntegrationConfig {
	enabled: boolean;
	phone_number_id: string;
	access_token: string;
	verify_token: string;
	display_phone_number: string | null;
	connected_at: string;
}

export interface WhatsappIntegrationPublic {
	type: "whatsapp";
	enabled: boolean;
	phone_number_id: string;
	display_phone_number: string | null;
	connected_at: string;
	webhook_url: string;
	verify_token: string;
	token_masked: string;
}

function integrationsRoot(settings: unknown): Record<string, unknown> {
	if (!settings || typeof settings !== "object") return {};
	const root = settings as Record<string, unknown>;
	const integrations = root.integrations;
	if (!integrations || typeof integrations !== "object") return {};
	return integrations as Record<string, unknown>;
}

export function parseWhatsappIntegration(
	settings: unknown,
): WhatsappIntegrationConfig | null {
	const wa = integrationsRoot(settings).whatsapp;
	if (!wa || typeof wa !== "object") return null;
	const o = wa as Record<string, unknown>;

	const phoneNumberId =
		typeof o.phone_number_id === "string" ? o.phone_number_id.trim() : "";
	const accessToken =
		typeof o.access_token === "string" && o.access_token.trim()
			? o.access_token.trim()
			: "";
	const verifyToken =
		typeof o.verify_token === "string" && o.verify_token.trim()
			? o.verify_token.trim()
			: "";

	if (!phoneNumberId || !accessToken || !verifyToken) return null;

	return {
		enabled: o.enabled !== false,
		phone_number_id: phoneNumberId,
		access_token: accessToken,
		verify_token: verifyToken,
		display_phone_number:
			typeof o.display_phone_number === "string"
				? o.display_phone_number
				: null,
		connected_at:
			typeof o.connected_at === "string"
				? o.connected_at
				: new Date().toISOString(),
	};
}

export function maskAccessToken(token: string): string {
	if (token.length <= 12) return "••••••••";
	return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

export function whatsappWebhookUrl(workspaceId: string): string {
	const base = getApiPublicBaseUrl();
	return `${base}/v1/integrations/whatsapp/webhook/${workspaceId}`;
}

export function toPublicWhatsappIntegration(
	config: WhatsappIntegrationConfig,
	workspaceId: string,
): WhatsappIntegrationPublic {
	return {
		type: "whatsapp",
		enabled: config.enabled,
		phone_number_id: config.phone_number_id,
		display_phone_number: config.display_phone_number,
		connected_at: config.connected_at,
		webhook_url: whatsappWebhookUrl(workspaceId),
		verify_token: config.verify_token,
		token_masked: maskAccessToken(config.access_token),
	};
}

export function mergeWhatsappIntegration(
	settings: unknown,
	config: WhatsappIntegrationConfig | null,
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
		const { whatsapp: _removed, ...rest } = integrations;
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
			whatsapp: config,
		},
	};
}

export function newWhatsappVerifyToken(): string {
	return randomUUID().replace(/-/g, "");
}

export function normalizeWhatsappPhone(waId: string): string {
	return waId.replace(/\D/g, "");
}
