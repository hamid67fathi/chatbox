export interface InboxCacheFilterKey {
	archived?: string;
	status?: string;
	channel?: string;
	limit?: number;
}

export function buildInboxCacheKey(
	workspaceId: string,
	filters: InboxCacheFilterKey,
	prefix = "chatbox_offline_inbox:",
): string {
	const parts = [
		workspaceId,
		filters.archived ?? "false",
		filters.status ?? "",
		filters.channel ?? "",
		String(filters.limit ?? 30),
	];
	return `${prefix}${parts.join(":")}`;
}
