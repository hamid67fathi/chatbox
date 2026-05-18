import { ApiError } from "./errors.js";

export interface GoogleUserProfile {
	sub: string;
	email: string;
	emailVerified: boolean;
	name?: string;
	picture?: string;
}

export function isGoogleOAuthConfigured(): boolean {
	return Boolean(
		process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
			process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
	);
}

export function getGoogleCallbackUrl(): string {
	const explicit = process.env.GOOGLE_OAUTH_CALLBACK_URL?.trim();
	if (explicit) return explicit;
	const base =
		process.env.API_PUBLIC_URL?.trim() ?? "http://localhost:3001";
	return `${base.replace(/\/$/, "")}/v1/auth/google/callback`;
}

export function getGoogleAllowedDomains(): string[] {
	const raw = process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS?.trim();
	if (!raw) return [];
	return raw
		.split(",")
		.map((d) => d.trim().toLowerCase())
		.filter(Boolean);
}

export function assertEmailDomainAllowed(email: string): void {
	const allowed = getGoogleAllowedDomains();
	if (allowed.length === 0) return;
	const domain = email.split("@")[1]?.toLowerCase();
	if (!domain || !allowed.includes(domain)) {
		throw new ApiError({
			code: "forbidden",
			message: `Google sign-in is restricted to: ${allowed.join(", ")}`,
			statusCode: 403,
		});
	}
}

export function buildGoogleAuthUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
		redirect_uri: getGoogleCallbackUrl(),
		response_type: "code",
		scope: "openid email profile",
		state,
		access_type: "online",
		prompt: "select_account",
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(
	code: string,
): Promise<{ access_token: string }> {
	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
			client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
			redirect_uri: getGoogleCallbackUrl(),
			grant_type: "authorization_code",
		}),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new ApiError({
			code: "oauth_error",
			message: `Google token exchange failed: ${text.slice(0, 200)}`,
			statusCode: 502,
		});
	}
	const json = (await res.json()) as { access_token?: string };
	if (!json.access_token) {
		throw new ApiError({
			code: "oauth_error",
			message: "Google token response missing access_token.",
			statusCode: 502,
		});
	}
	return { access_token: json.access_token };
}

export async function fetchGoogleUserProfile(
	accessToken: string,
): Promise<GoogleUserProfile> {
	const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		throw new ApiError({
			code: "oauth_error",
			message: "Failed to fetch Google user profile.",
			statusCode: 502,
		});
	}
	const json = (await res.json()) as {
		sub?: string;
		email?: string;
		email_verified?: boolean;
		name?: string;
		picture?: string;
	};
	if (!json.sub || !json.email) {
		throw new ApiError({
			code: "oauth_error",
			message: "Google profile missing sub or email.",
			statusCode: 502,
		});
	}
	return {
		sub: json.sub,
		email: json.email.toLowerCase(),
		emailVerified: json.email_verified === true,
		name: json.name,
		picture: json.picture,
	};
}

export function getDashboardOAuthRedirectUrl(
	path: string,
	query?: Record<string, string>,
): string {
	const base = (
		process.env.DASHBOARD_URL?.trim() ?? "http://localhost:3000"
	).replace(/\/$/, "");
	const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			url.searchParams.set(k, v);
		}
	}
	return url.toString();
}
