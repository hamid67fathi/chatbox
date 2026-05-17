import type { FastifyRequest } from "fastify";

export interface VisitorContext {
	ip?: string | null;
	country?: string | null;
	countryCode?: string | null;
	currentPageUrl?: string | null;
	currentPageUrlAt?: string | null;
	userAgent?: string | null;
	browser?: string | null;
	os?: string | null;
	device?: string | null;
	utm?: Record<string, string>;
	updatedAt?: string | null;
}

const COUNTRY_NAMES_FA: Record<string, string> = {
	IR: "ایران",
	US: "ایالات متحده",
	DE: "آلمان",
	GB: "بریتانیا",
	TR: "ترکیه",
	AE: "امارات",
	IQ: "عراق",
	AF: "افغانستان",
};

export function clientIp(request: FastifyRequest): string | null {
	const forwarded = request.headers["x-forwarded-for"];
	if (typeof forwarded === "string" && forwarded.length > 0) {
		return forwarded.split(",")[0]?.trim() ?? null;
	}
	if (Array.isArray(forwarded) && forwarded[0]) {
		return String(forwarded[0]).split(",")[0]?.trim() ?? null;
	}
	return request.ip ?? null;
}

function countryFromHeaders(request: FastifyRequest): {
	countryCode?: string;
	country?: string;
} {
	const code =
		(typeof request.headers["cf-ipcountry"] === "string" &&
			request.headers["cf-ipcountry"]) ||
		(typeof request.headers["x-vercel-ip-country"] === "string" &&
			request.headers["x-vercel-ip-country"]) ||
		undefined;
	if (!code || code === "XX" || code.length !== 2) return {};
	const upper = code.toUpperCase();
	return {
		countryCode: upper,
		country: COUNTRY_NAMES_FA[upper] ?? upper,
	};
}

export function parseUserAgent(ua: string | undefined): {
	browser: string | null;
	os: string | null;
	device: string | null;
} {
	if (!ua) return { browser: null, os: null, device: null };

	const lower = ua.toLowerCase();
	let device: string = "desktop";
	if (/ipad|tablet/i.test(ua)) device = "tablet";
	else if (/mobile|android|iphone|ipod|blackberry|iemobile/i.test(ua))
		device = "mobile";

	let browser = "نامشخص";
	if (lower.includes("edg/")) browser = "Edge";
	else if (lower.includes("firefox/")) browser = "Firefox";
	else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";
	else if (lower.includes("chrome/") && !lower.includes("edg/")) browser = "Chrome";
	else if (lower.includes("safari/") && !lower.includes("chrome/"))
		browser = "Safari";

	let os = "نامشخص";
	if (lower.includes("windows")) os = "Windows";
	else if (lower.includes("mac os x") || lower.includes("macintosh")) os = "macOS";
	else if (lower.includes("android")) os = "Android";
	else if (/iphone|ipad|ipod/.test(lower)) os = "iOS";
	else if (lower.includes("linux")) os = "Linux";

	return { browser, os, device };
}

function normalizePageUrl(raw: string | undefined | null): string | null {
	if (!raw || typeof raw !== "string") return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		const u = new URL(trimmed);
		if (u.protocol !== "http:" && u.protocol !== "https:") return null;
		return u.href.slice(0, 2048);
	} catch {
		return null;
	}
}

export function captureVisitorContext(
	request: FastifyRequest,
	input?: { pageUrl?: string | null; metadata?: Record<string, unknown> | null },
): VisitorContext {
	const ip = clientIp(request);
	const ua =
		typeof request.headers["user-agent"] === "string"
			? request.headers["user-agent"]
			: null;
	const parsed = parseUserAgent(ua ?? undefined);
	const geo = countryFromHeaders(request);
	const pageUrl = normalizePageUrl(input?.pageUrl);

	const utm: Record<string, string> = {};
	const meta = input?.metadata;
	if (meta && typeof meta === "object") {
		for (const key of [
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
		] as const) {
			const v = meta[key];
			if (typeof v === "string" && v.trim()) utm[key] = v.trim().slice(0, 256);
		}
	}

	return {
		ip,
		...geo,
		currentPageUrl: pageUrl,
		currentPageUrlAt: pageUrl ? new Date().toISOString() : undefined,
		userAgent: ua,
		browser: parsed.browser,
		os: parsed.os,
		device: parsed.device,
		...(Object.keys(utm).length > 0 ? { utm } : {}),
		updatedAt: new Date().toISOString(),
	};
}

export function mergeVisitorMetadata(
	existing: unknown,
	incoming: VisitorContext,
): Record<string, unknown> {
	const base =
		existing && typeof existing === "object"
			? { ...(existing as Record<string, unknown>) }
			: {};
	const prev =
		base.visitor && typeof base.visitor === "object"
			? { ...(base.visitor as Record<string, unknown>) }
			: {};

	const merged: VisitorContext = {
		...(prev as VisitorContext),
		...incoming,
		utm: { ...(prev.utm as Record<string, string> | undefined), ...incoming.utm },
	};

	if (!incoming.currentPageUrl && prev.currentPageUrl) {
		merged.currentPageUrl = String(prev.currentPageUrl);
		merged.currentPageUrlAt =
			typeof prev.currentPageUrlAt === "string"
				? prev.currentPageUrlAt
				: undefined;
	}

	base.visitor = merged;
	return base;
}

export function visitorFromMetadata(metadata: unknown): VisitorContext | null {
	if (!metadata || typeof metadata !== "object") return null;
	const v = (metadata as { visitor?: unknown }).visitor;
	if (!v || typeof v !== "object") return null;
	const o = v as Record<string, unknown>;
	return {
		ip: typeof o.ip === "string" ? o.ip : null,
		country: typeof o.country === "string" ? o.country : null,
		countryCode: typeof o.countryCode === "string" ? o.countryCode : null,
		currentPageUrl:
			typeof o.currentPageUrl === "string" ? o.currentPageUrl : null,
		currentPageUrlAt:
			typeof o.currentPageUrlAt === "string" ? o.currentPageUrlAt : null,
		userAgent: typeof o.userAgent === "string" ? o.userAgent : null,
		browser: typeof o.browser === "string" ? o.browser : null,
		os: typeof o.os === "string" ? o.os : null,
		device: typeof o.device === "string" ? o.device : null,
		utm:
			o.utm && typeof o.utm === "object"
				? (o.utm as Record<string, string>)
				: undefined,
		updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
	};
}

export function serializeVisitorForApi(
	visitor: VisitorContext | null,
): Record<string, unknown> | null {
	if (!visitor) return null;
	return {
		ip: visitor.ip,
		country: visitor.country,
		country_code: visitor.countryCode,
		current_page_url: visitor.currentPageUrl,
		current_page_url_at: visitor.currentPageUrlAt,
		browser: visitor.browser,
		os: visitor.os,
		device: visitor.device,
		utm: visitor.utm,
		updated_at: visitor.updatedAt,
	};
}
