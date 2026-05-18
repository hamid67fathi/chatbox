import {
	normalizeSoundId,
	playNotificationSound,
	shouldPlayNotificationSound,
	type NotificationSoundId,
} from "@chatbox/shared/notification-sound";

const STORAGE_KEY = "chatbox_widget_sound_v1";

export interface WidgetSoundPrefs {
	sound_enabled: boolean;
	sound_id: NotificationSoundId;
	sound_when_hidden: boolean;
}

const DEFAULTS: WidgetSoundPrefs = {
	sound_enabled: true,
	sound_id: "default",
	sound_when_hidden: false,
};

export function loadWidgetSoundPrefs(): WidgetSoundPrefs {
	if (typeof localStorage === "undefined") return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const o = JSON.parse(raw) as Record<string, unknown>;
		return {
			sound_enabled:
				typeof o.sound_enabled === "boolean"
					? o.sound_enabled
					: DEFAULTS.sound_enabled,
			sound_id: normalizeSoundId(o.sound_id),
			sound_when_hidden:
				typeof o.sound_when_hidden === "boolean"
					? o.sound_when_hidden
					: DEFAULTS.sound_when_hidden,
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveWidgetSoundPrefs(prefs: WidgetSoundPrefs): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function maybePlayWidgetIncomingSound(senderType: string): void {
	if (senderType !== "agent" && senderType !== "ai") return;
	const prefs = loadWidgetSoundPrefs();
	const tabVisible =
		typeof document !== "undefined" &&
		document.visibilityState === "visible";
	if (
		!shouldPlayNotificationSound({
			soundEnabled: prefs.sound_enabled,
			tabVisible,
			playWhenTabHidden: prefs.sound_when_hidden,
		})
	) {
		return;
	}
	playNotificationSound(prefs.sound_id);
}

export function previewWidgetSound(soundId: NotificationSoundId): void {
	playNotificationSound(soundId);
}
