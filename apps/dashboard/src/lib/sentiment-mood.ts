export function parseSentimentScore(
	raw: string | number | null | undefined,
): number | null {
	if (raw == null || raw === "") return null;
	const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
	return Number.isFinite(n) ? n : null;
}

export function sentimentMood(score: number | null | undefined) {
	if (score == null) {
		return { emoji: "⚪", label: "نامشخص", className: "text-muted-foreground" };
	}
	if (score >= 0.35) {
		return { emoji: "😊", label: "مثبت", className: "text-emerald-600" };
	}
	if (score <= -0.35) {
		return { emoji: "😟", label: "منفی", className: "text-destructive" };
	}
	return { emoji: "😐", label: "خنثی", className: "text-muted-foreground" };
}
