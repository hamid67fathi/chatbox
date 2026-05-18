import { visitorStorageKey } from "./api.js";

const COOKIE_NAME = "cbx_vid";
const COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

function readCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const prefix = `${name}=`;
	const parts = document.cookie.split(";").map((p) => p.trim());
	for (const part of parts) {
		if (part.startsWith(prefix)) {
			return decodeURIComponent(part.slice(prefix.length));
		}
	}
	return null;
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
	if (typeof document === "undefined") return;
	const secure =
		typeof location !== "undefined" && location.protocol === "https:"
			? "; Secure"
			: "";
	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

export function loadVisitorId(workspaceSlug: string): string | undefined {
	const fromCookie = readCookie(COOKIE_NAME);
	if (fromCookie) return fromCookie;
	try {
		return localStorage.getItem(visitorStorageKey(workspaceSlug)) ?? undefined;
	} catch {
		return undefined;
	}
}

export function persistVisitorId(workspaceSlug: string, visitorId: string) {
	writeCookie(COOKIE_NAME, visitorId, COOKIE_MAX_AGE_SEC);
	try {
		localStorage.setItem(visitorStorageKey(workspaceSlug), visitorId);
	} catch {
		/* private mode */
	}
}
