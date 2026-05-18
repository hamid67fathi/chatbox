import { API_URL } from "./config";
import { clearAuth, getAccessToken, setAuth } from "./auth";
import type { AuthData, Conversation, Message } from "./types";

function authHeaders(workspaceId: string, token: string): Record<string, string> {
	return {
		"X-Workspace-Id": workspaceId,
		Authorization: `Bearer ${token}`,
	};
}

async function refreshAccessToken(): Promise<string | null> {
	const { getAuth: loadAuth } = await import("./auth");
	const auth = await loadAuth();
	if (!auth?.refresh_token) return null;

	const res = await fetch(`${API_URL}/v1/auth/refresh`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refresh_token: auth.refresh_token }),
	});
	if (!res.ok) return null;
	const data = (await res.json()) as {
		access_token: string;
		refresh_token?: string;
	};
	const updated: AuthData = {
		...auth,
		access_token: data.access_token,
		refresh_token: data.refresh_token ?? auth.refresh_token,
	};
	await setAuth(updated);
	return data.access_token;
}

async function authFetch(
	url: string,
	workspaceId: string,
	init: RequestInit = {},
): Promise<Response> {
	const token = await getAccessToken();
	if (!token) {
		return new Response(null, { status: 401 });
	}

	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("X-Workspace-Id", workspaceId);

	let res = await fetch(url, { ...init, headers });

	if (res.status === 401) {
		const newToken = await refreshAccessToken();
		if (!newToken) {
			await clearAuth();
			return res;
		}
		headers.set("Authorization", `Bearer ${newToken}`);
		res = await fetch(url, { ...init, headers });
	}

	return res;
}

function normalizeConversation(raw: Record<string, unknown>): Conversation {
	const contact = raw.contact as Record<string, unknown> | undefined;
	return {
		id: String(raw.id),
		channel: String(raw.channel ?? "web"),
		status: String(raw.status ?? "open"),
		subject: (raw.subject as string | null) ?? null,
		lastMessageAt:
			(raw.lastMessageAt as string | null) ??
			(raw.last_message_at as string | null) ??
			null,
		contact: contact
			? {
					fullName: (contact.fullName ?? contact.full_name) as
						| string
						| undefined,
					email: (contact.email as string | null) ?? null,
				}
			: undefined,
	};
}

function normalizeMessage(raw: Record<string, unknown>): Message {
	return {
		id: String(raw.id),
		body: String(raw.body ?? ""),
		senderType: String(raw.senderType ?? raw.sender_type ?? "agent"),
		createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
	};
}

export async function login(
	email: string,
	password: string,
): Promise<
	| { ok: true; auth: AuthData }
	| { ok: false; error: string }
	| { ok: false; requires2fa: true; pendingToken: string }
> {
	const res = await fetch(`${API_URL}/v1/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			ok: false,
			error: (data as { error?: { message?: string } })?.error?.message ??
				"ورود ناموفق بود.",
		};
	}
	if (data.requires_2fa && data.pending_token) {
		return { ok: false, requires2fa: true, pendingToken: data.pending_token };
	}
	return { ok: true, auth: data as AuthData };
}

export async function login2fa(
	pendingToken: string,
	code?: string,
	recoveryCode?: string,
): Promise<{ ok: true; auth: AuthData } | { ok: false; error: string }> {
	const res = await fetch(`${API_URL}/v1/auth/login/2fa`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			pending_token: pendingToken,
			code: recoveryCode ? undefined : code,
			recovery_code: recoveryCode,
		}),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			ok: false,
			error: (data as { error?: { message?: string } })?.error?.message ??
				"کد نامعتبر است.",
		};
	}
	return { ok: true, auth: data as AuthData };
}

export async function fetchConversations(
	workspaceId: string,
): Promise<Conversation[]> {
	const res = await authFetch(
		`${API_URL}/v1/conversations?limit=50&archived=false`,
		workspaceId,
		{ cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: Record<string, unknown>[] };
	return (json.data ?? []).map((row) => normalizeConversation(row));
}

export async function fetchMessages(
	workspaceId: string,
	conversationId: string,
): Promise<Message[]> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/messages?limit=100`,
		workspaceId,
		{ cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: Record<string, unknown>[] };
	return (json.data ?? []).map((row) => normalizeMessage(row));
}

export async function sendMessage(
	workspaceId: string,
	conversationId: string,
	body: string,
): Promise<Message | null> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/messages`,
		workspaceId,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body, sender_type: "agent" }),
		},
	);
	if (!res.ok) return null;
	const raw = (await res.json()) as Record<string, unknown>;
	return normalizeMessage(raw);
}
