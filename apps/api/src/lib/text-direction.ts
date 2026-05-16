const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** Detect predominant text direction for mixed RTL/LTR chat content. */
export function detectTextDirection(text: string, fallback: "rtl" | "ltr" = "rtl"): "rtl" | "ltr" {
	const sample = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
	if (!sample) return fallback;
	let rtl = 0;
	for (const ch of sample) {
		if (RTL_RE.test(ch)) rtl++;
	}
	return rtl / sample.length >= 0.35 ? "rtl" : "ltr";
}
