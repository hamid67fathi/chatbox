import type { NotificationPreferences } from "@/lib/api";
import { getCachedNotificationPrefs } from "@/lib/notification-sound-prefs";

export function browserNotificationsSupported(): boolean {
	return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission():
	| NotificationPermission
	| "unsupported" {
	if (!browserNotificationsSupported()) return "unsupported";
	return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
	NotificationPermission | "unsupported"
> {
	if (!browserNotificationsSupported()) return "unsupported";
	if (Notification.permission === "granted") return "granted";
	if (Notification.permission === "denied") return "denied";
	try {
		return await Notification.requestPermission();
	} catch {
		return "denied";
	}
}

function truncate(text: string, max: number): string {
	const t = text.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1)}…`;
}

function inboxUrl(conversationId?: string): string {
	if (typeof window === "undefined") return "/";
	const base = window.location.origin + window.location.pathname;
	if (!conversationId) return base;
	return `${base}?c=${encodeURIComponent(conversationId)}`;
}

/** Show OS notification when tab is in background (page still open). */
export function showBrowserNotification(opts: {
	title: string;
	body: string;
	tag?: string;
	conversationId?: string;
}): void {
	if (!browserNotificationsSupported()) return;
	if (Notification.permission !== "granted") return;
	if (
		typeof document !== "undefined" &&
		document.visibilityState === "visible"
	) {
		return;
	}

	const url = inboxUrl(opts.conversationId);
	try {
		const n = new Notification(opts.title, {
			body: opts.body,
			tag: opts.tag ?? "chatbox",
			dir: "rtl",
			lang: "fa",
		});
		n.onclick = () => {
			window.focus();
			if (opts.conversationId) {
				window.location.href = url;
			}
			n.close();
		};
	} catch {
		/* permission denied or blocked */
	}
}

function prefsAllow(
	prefs: NotificationPreferences,
	key:
		| "browser_new_conversation"
		| "browser_new_message"
		| "browser_needs_human",
): boolean {
	return prefs.browser_enabled && prefs[key];
}

export function maybeShowBrowserMessageNotification(opts: {
	senderType: string;
	conversationId: string;
	contactName?: string | null;
	messageBody?: string | null;
}) {
	const prefs = getCachedNotificationPrefs();
	if (!prefsAllow(prefs, "browser_new_message")) return;
	if (opts.senderType !== "contact") return;

	const name = opts.contactName?.trim() || "مشتری";
	showBrowserNotification({
		title: `پیام جدید — ${name}`,
		body: truncate(opts.messageBody ?? "پیام جدید دریافت شد", 140),
		tag: `msg-${opts.conversationId}`,
		conversationId: opts.conversationId,
	});
}

export function maybeShowBrowserConversationNotification(opts: {
	contactName?: string | null;
	conversationId: string;
}) {
	const prefs = getCachedNotificationPrefs();
	if (!prefsAllow(prefs, "browser_new_conversation")) return;

	showBrowserNotification({
		title: "مکالمه جدید",
		body: opts.contactName?.trim()
			? `مکالمه با ${opts.contactName.trim()}`
			: "مکالمه جدید در صندوق ورودی",
		tag: `conv-${opts.conversationId}`,
		conversationId: opts.conversationId,
	});
}

export function maybeShowBrowserNeedsHumanNotification(opts: {
	conversationId: string;
	contactName?: string | null;
}) {
	const prefs = getCachedNotificationPrefs();
	if (!prefsAllow(prefs, "browser_needs_human")) return;

	showBrowserNotification({
		title: "نیاز به اپراتور",
		body: opts.contactName?.trim()
			? `${opts.contactName.trim()} — AI به کمک انسانی نیاز دارد`
			: "مکالمه‌ای به اپراتور انسانی نیاز دارد",
		tag: `needs-human-${opts.conversationId}`,
		conversationId: opts.conversationId,
	});
}

export function previewBrowserNotification(): void {
	if (!browserNotificationsSupported()) return;
	if (Notification.permission !== "granted") return;
	try {
		const n = new Notification("ChatBox — پیش‌نمایش", {
			body: "اعلان مرورگر فعال است.",
			tag: "chatbox-preview",
			dir: "rtl",
			lang: "fa",
		});
		setTimeout(() => n.close(), 4000);
	} catch {
		/* ignore */
	}
}
