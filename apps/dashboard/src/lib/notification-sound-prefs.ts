import type { NotificationPreferences } from "@/lib/api";
import { fetchNotificationPreferences } from "@/lib/api";
import {
	normalizeSoundId,
	playNotificationSound,
	shouldPlayNotificationSound,
	type NotificationSoundId,
} from "@chatbox/shared/notification-sound";

const SOUND_DEFAULTS: NotificationPreferences = {
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

let cachedWorkspaceId: string | null = null;
let cachedPrefs: NotificationPreferences = SOUND_DEFAULTS;

export async function loadNotificationSoundPrefs(
	workspaceId: string,
): Promise<NotificationPreferences> {
	if (cachedWorkspaceId === workspaceId) {
		return cachedPrefs;
	}
	const prefs = await fetchNotificationPreferences(workspaceId);
	cachedWorkspaceId = workspaceId;
	cachedPrefs = prefs ?? SOUND_DEFAULTS;
	return cachedPrefs;
}

export function setNotificationSoundPrefsCache(
	workspaceId: string,
	prefs: NotificationPreferences,
) {
	cachedWorkspaceId = workspaceId;
	cachedPrefs = prefs;
}

export function getCachedNotificationPrefs(): NotificationPreferences {
	return cachedPrefs;
}

export function maybePlayIncomingMessageSound(opts: {
	senderType: string;
	conversationId: string;
	activeConversationId: string | null;
}) {
	const prefs = cachedPrefs;
	if (!prefs?.sound_enabled) return;
	const { senderType, conversationId, activeConversationId } = opts;
	if (senderType !== "contact") return;

	const tabVisible =
		typeof document !== "undefined" &&
		document.visibilityState === "visible";

	if (
		!shouldPlayNotificationSound({
			soundEnabled: true,
			tabVisible,
			playWhenTabHidden: prefs.sound_when_hidden,
		})
	) {
		return;
	}

	if (
		tabVisible &&
		activeConversationId === conversationId
	) {
		return;
	}

	playNotificationSound(normalizeSoundId(prefs.sound_id) as NotificationSoundId);
}

export function previewNotificationSound(soundId: string) {
	playNotificationSound(normalizeSoundId(soundId) as NotificationSoundId);
}
