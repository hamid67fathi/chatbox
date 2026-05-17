export function currentPageUrl(): string | null {
	if (typeof window === "undefined" || !window.location?.href) return null;
	return window.location.href;
}

export function utmMetadataFromLocation(): Record<string, string> {
	if (typeof window === "undefined") return {};
	try {
		const params = new URLSearchParams(window.location.search);
		const out: Record<string, string> = {};
		for (const key of [
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
		]) {
			const v = params.get(key);
			if (v) out[key] = v;
		}
		return out;
	} catch {
		return {};
	}
}

export function currentPageTitle(): string | null {
	if (typeof document === "undefined" || !document.title) return null;
	const t = document.title.trim();
	return t ? t.slice(0, 256) : null;
}

export function pageContextPayload(): {
	page_url: string | null;
	page_title: string | null;
	metadata: Record<string, string>;
} {
	const utm = utmMetadataFromLocation();
	return {
		page_url: currentPageUrl(),
		page_title: currentPageTitle(),
		metadata: Object.keys(utm).length > 0 ? utm : {},
	};
}

export function bindPageNavigation(onChange: () => void): () => void {
	if (typeof window === "undefined") return () => {};

	const fire = () => onChange();
	window.addEventListener("popstate", fire);

	const push = history.pushState.bind(history);
	const replace = history.replaceState.bind(history);

	history.pushState = (...args: Parameters<History["pushState"]>) => {
		push(...args);
		fire();
	};
	history.replaceState = (...args: Parameters<History["replaceState"]>) => {
		replace(...args);
		fire();
	};

	return () => {
		window.removeEventListener("popstate", fire);
		history.pushState = push;
		history.replaceState = replace;
	};
}
