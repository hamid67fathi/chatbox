const STORAGE_KEY = "chatbox_widget_browser_v1";

export interface WidgetBrowserPrefs {
	enabled: boolean;
}

const DEFAULTS: WidgetBrowserPrefs = { enabled: true };

export function loadWidgetBrowserPrefs(): WidgetBrowserPrefs {
	if (typeof localStorage === "undefined") return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const o = JSON.parse(raw) as Record<string, unknown>;
		return {
			enabled:
				typeof o.enabled === "boolean" ? o.enabled : DEFAULTS.enabled,
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveWidgetBrowserPrefs(prefs: WidgetBrowserPrefs): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function maybeShowWidgetBrowserNotification(
	senderType: string,
	body: string,
): void {
	if (senderType !== "agent" && senderType !== "ai") return;
	if (!loadWidgetBrowserPrefs().enabled) return;
	if (typeof window === "undefined" || !("Notification" in window)) return;
	if (Notification.permission !== "granted") return;
	if (document.visibilityState === "visible") return;

	const text = body.trim().slice(0, 140) || "پاسخ جدید از پشتیبانی";
	try {
		const n = new Notification("پشتیبانی", {
			body: text,
			tag: "chatbox-widget-reply",
			dir: "rtl",
			lang: "fa",
		});
		n.onclick = () => {
			window.focus();
			n.close();
		};
	} catch {
		/* ignore */
	}
}

export async function requestWidgetBrowserPermission(): Promise<boolean> {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return false;
	}
	if (Notification.permission === "granted") return true;
	if (Notification.permission === "denied") return false;
	try {
		return (await Notification.requestPermission()) === "granted";
	} catch {
		return false;
	}
}
