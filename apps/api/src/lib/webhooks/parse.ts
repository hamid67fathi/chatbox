import { WEBHOOK_EVENTS, type WebhookEventType } from "./types.js";

const EVENT_SET = new Set<string>(WEBHOOK_EVENTS);

export function parseWebhookEvents(raw: unknown): WebhookEventType[] {
	if (!Array.isArray(raw)) return [...WEBHOOK_EVENTS];
	return raw.filter((e): e is WebhookEventType =>
		typeof e === "string" && EVENT_SET.has(e),
	);
}

export function isValidWebhookUrl(url: string): boolean {
	try {
		const u = new URL(url);
		return u.protocol === "https:" || u.protocol === "http:";
	} catch {
		return false;
	}
}
