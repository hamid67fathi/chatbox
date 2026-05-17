"use client";

const STORAGE_KEY = "chatbox_auth";

export interface AuthData {
	access_token: string;
	refresh_token: string;
	session_id: string;
	user: {
		id: string;
		email: string;
		full_name?: string;
		avatar_url?: string | null;
		locale?: string;
		workspaces?: { id: string; role: string }[];
	};
}

export function getAuth(): AuthData | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function setAuth(data: AuthData): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuth(): void {
	localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
	return getAuth()?.access_token ?? null;
}

export function getWorkspaceIdFromAuth(): string | null {
	const auth = getAuth();
	if (auth?.user?.workspaces?.[0]?.id) return auth.user.workspaces[0].id;
	return process.env.NEXT_PUBLIC_WORKSPACE_ID ?? null;
}

export async function refreshAuthUser(): Promise<AuthData | null> {
	const auth = getAuth();
	if (!auth?.access_token) return null;

	try {
		const res = await fetch(`${API_URL}/v1/auth/me`, {
			headers: { Authorization: `Bearer ${auth.access_token}` },
		});
		if (!res.ok) return auth;
		const data = await res.json();
		const updated: AuthData = {
			...auth,
			user: {
				...auth.user,
				...data.user,
				workspaces: data.user.workspaces,
			},
		};
		setAuth(updated);
		return updated;
	} catch {
		return auth;
	}
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function refreshAccessToken(): Promise<string | null> {
	const auth = getAuth();
	if (!auth?.refresh_token) return null;

	try {
		const res = await fetch(`${API_URL}/v1/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: auth.refresh_token }),
		});
		if (!res.ok) {
			clearAuth();
			return null;
		}
		const data = await res.json();
		setAuth({ ...auth, access_token: data.access_token, refresh_token: data.refresh_token });
		return data.access_token;
	} catch {
		clearAuth();
		return null;
	}
}
