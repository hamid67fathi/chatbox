import { randomUUID } from "node:crypto";

export interface NotificationPreferences {
	push_enabled: boolean;
	new_conversation: boolean;
	new_message: boolean;
	email_enabled: boolean;
	email_new_conversation: boolean;
	email_assigned: boolean;
	email_mention: boolean;
	sound_enabled: boolean;
	sound_id: string;
	sound_when_hidden: boolean;
	browser_enabled: boolean;
	browser_new_conversation: boolean;
	browser_new_message: boolean;
	browser_needs_human: boolean;
	email_unsubscribe_token?: string;
}

const DEFAULTS: NotificationPreferences = {
	push_enabled: true,
	new_conversation: true,
	new_message: true,
	email_enabled: true,
	email_new_conversation: true,
	email_assigned: true,
	email_mention: true,
	sound_enabled: true,
	sound_id: "default",
	sound_when_hidden: false,
	browser_enabled: true,
	browser_new_conversation: true,
	browser_new_message: true,
	browser_needs_human: true,
};

export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
	if (!raw || typeof raw !== "object") return { ...DEFAULTS };
	const o = raw as Record<string, unknown>;
	return {
		push_enabled:
			typeof o.push_enabled === "boolean"
				? o.push_enabled
				: DEFAULTS.push_enabled,
		new_conversation:
			typeof o.new_conversation === "boolean"
				? o.new_conversation
				: DEFAULTS.new_conversation,
		new_message:
			typeof o.new_message === "boolean"
				? o.new_message
				: DEFAULTS.new_message,
		email_enabled:
			typeof o.email_enabled === "boolean"
				? o.email_enabled
				: DEFAULTS.email_enabled,
		email_new_conversation:
			typeof o.email_new_conversation === "boolean"
				? o.email_new_conversation
				: DEFAULTS.email_new_conversation,
		email_assigned:
			typeof o.email_assigned === "boolean"
				? o.email_assigned
				: DEFAULTS.email_assigned,
		email_mention:
			typeof o.email_mention === "boolean"
				? o.email_mention
				: DEFAULTS.email_mention,
		sound_enabled:
			typeof o.sound_enabled === "boolean"
				? o.sound_enabled
				: DEFAULTS.sound_enabled,
		sound_id:
			typeof o.sound_id === "string" && o.sound_id.trim()
				? o.sound_id.trim()
				: DEFAULTS.sound_id,
		sound_when_hidden:
			typeof o.sound_when_hidden === "boolean"
				? o.sound_when_hidden
				: DEFAULTS.sound_when_hidden,
		browser_enabled:
			typeof o.browser_enabled === "boolean"
				? o.browser_enabled
				: DEFAULTS.browser_enabled,
		browser_new_conversation:
			typeof o.browser_new_conversation === "boolean"
				? o.browser_new_conversation
				: DEFAULTS.browser_new_conversation,
		browser_new_message:
			typeof o.browser_new_message === "boolean"
				? o.browser_new_message
				: DEFAULTS.browser_new_message,
		browser_needs_human:
			typeof o.browser_needs_human === "boolean"
				? o.browser_needs_human
				: DEFAULTS.browser_needs_human,
		email_unsubscribe_token:
			typeof o.email_unsubscribe_token === "string"
				? o.email_unsubscribe_token
				: undefined,
	};
}

export function mergeNotificationPreferences(
	existing: unknown,
	patch: Partial<NotificationPreferences>,
): NotificationPreferences {
	const base = parseNotificationPreferences(existing);
	const merged = { ...base, ...patch };
	if (merged.email_enabled && !merged.email_unsubscribe_token) {
		merged.email_unsubscribe_token = randomUUID();
	}
	return merged;
}

export function ensureUnsubscribeToken(
	prefs: NotificationPreferences,
): NotificationPreferences {
	if (prefs.email_enabled && !prefs.email_unsubscribe_token) {
		return { ...prefs, email_unsubscribe_token: randomUUID() };
	}
	return prefs;
}
