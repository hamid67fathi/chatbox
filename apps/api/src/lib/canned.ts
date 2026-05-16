/** Replace `{{name}}` style placeholders in canned response bodies. */
export function applyCannedVariables(
	body: string,
	vars: Record<string, string>,
): string {
	return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function extractVariableNames(body: string): string[] {
	const names = new Set<string>();
	for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) {
		if (m[1]) names.add(m[1]);
	}
	return [...names];
}
