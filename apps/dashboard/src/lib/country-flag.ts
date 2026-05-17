/** ISO 3166-1 alpha-2 → regional indicator emoji (e.g. IR → 🇮🇷). */
export function countryFlagEmoji(code: string | null | undefined): string {
	if (!code || code.length !== 2) return "";
	const upper = code.toUpperCase();
	const a = upper.codePointAt(0);
	const b = upper.codePointAt(1);
	if (a === undefined || b === undefined) return "";
	if (a < 65 || a > 90 || b < 65 || b > 90) return "";
	return String.fromCodePoint(0x1f1e6 + a - 65, 0x1f1e6 + b - 65);
}
