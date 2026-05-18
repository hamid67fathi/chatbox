const SUPPORTED = new Set(["fa", "en", "ar"]);

export function localeToLang(locale: string | null | undefined): "fa" | "en" | "ar" {
	if (!locale) return "fa";
	const low = locale.trim().toLowerCase();
	if (low.startsWith("en")) return "en";
	if (low.startsWith("ar")) return "ar";
	if (low.startsWith("fa")) return "fa";
	const prefix = low.split("-")[0];
	if (SUPPORTED.has(prefix)) return prefix as "fa" | "en" | "ar";
	return "fa";
}
