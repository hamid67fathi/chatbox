import type { CannedResponse } from "./api";

export function applyCannedVariables(
	body: string,
	vars: Record<string, string>,
): string {
	return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function defaultCannedVariables(contactName?: string | null): Record<string, string> {
	return {
		name: contactName?.trim() || "مشتری",
	};
}

export function resolveCannedByShortcut(
	text: string,
	items: CannedResponse[],
	vars: Record<string, string>,
): { body: string; item: CannedResponse } | null {
	const trimmed = text.trim().toLowerCase();
	const item = items.find((c) => c.shortcut.toLowerCase() === trimmed);
	if (!item) return null;
	return { body: applyCannedVariables(item.body, vars), item };
}

export function filterCannedByQuery(items: CannedResponse[], query: string): CannedResponse[] {
	const q = query.trim().toLowerCase();
	if (!q.startsWith("/")) return [];
	const needle = q.slice(1);
	return items.filter(
		(c) =>
			c.shortcut.toLowerCase().includes(q) ||
			(needle && c.shortcut.toLowerCase().includes(`/${needle}`)) ||
			c.title.toLowerCase().includes(needle),
	);
}
