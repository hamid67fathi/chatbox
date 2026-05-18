import type { Conversation, ConversationFilters } from "@/lib/api";
import { buildInboxCacheKey as buildKey } from "@chatbox/shared/offline-inbox";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function buildInboxCacheKey(
	workspaceId: string,
	filters: ConversationFilters,
): string {
	return buildKey(workspaceId, {
		archived: filters.archived,
		status: filters.status,
		channel: filters.channel,
		limit: filters.limit,
	});
}

interface CachedInbox {
	savedAt: number;
	conversations: Conversation[];
}

export function saveOfflineInbox(
	key: string,
	conversations: Conversation[],
): void {
	if (typeof window === "undefined") return;
	try {
		const payload: CachedInbox = {
			savedAt: Date.now(),
			conversations,
		};
		localStorage.setItem(key, JSON.stringify(payload));
	} catch {
		/* quota */
	}
}

export function loadOfflineInbox(key: string): Conversation[] | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CachedInbox;
		if (!parsed?.conversations || !Array.isArray(parsed.conversations)) {
			return null;
		}
		if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
			localStorage.removeItem(key);
			return null;
		}
		return parsed.conversations;
	} catch {
		return null;
	}
}
