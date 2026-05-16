import { clearAuth, getAccessToken, refreshAccessToken } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Conversation {
	id: string;
	contactId: string;
	channel: string;
	status: string;
	subject: string | null;
	assignedUserId: string | null;
	lastMessageAt: string | null;
	createdAt: string;
	aiHandled?: boolean;
	needsHuman?: boolean;
	contact?: {
		id: string;
		fullName: string;
		email: string | null;
	};
}

export interface Message {
	id: string;
	conversationId: string;
	senderType: string;
	senderUserId: string | null;
	senderContactId: string | null;
	body: string;
	type: string;
	createdAt: string;
}

function authHeaders(workspaceId: string): Record<string, string> {
	const token = getAccessToken();
	return {
		"X-Workspace-Id": workspaceId,
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
	let res: Response;
	try {
		res = await fetch(url, init);
	} catch {
		return new Response(
			JSON.stringify({
				error: {
					code: "network_error",
					message: `Cannot reach API at ${API_URL}. Is the API server running on port 3001?`,
				},
			}),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	if (res.status === 401) {
		const newToken = await refreshAccessToken();
		if (newToken) {
			const headers = new Headers(init.headers);
			headers.set("Authorization", `Bearer ${newToken}`);
			res = await fetch(url, { ...init, headers });
		} else {
			clearAuth();
			if (typeof window !== "undefined") window.location.href = "/login";
		}
	}

	return res;
}

export interface WorkspaceSummary {
	id: string;
	name: string;
	slug: string;
	role?: string;
}

export async function fetchWorkspaces(): Promise<{
	data: WorkspaceSummary[];
	error?: string;
}> {
	const token = getAccessToken();
	if (!token) return { data: [], error: "Not logged in" };

	const res = await authFetch(`${API_URL}/v1/workspaces`, {
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return {
			data: [],
			error: body?.error?.message ?? `HTTP ${res.status}`,
		};
	}
	const json = await res.json();
	return { data: json.data ?? [] };
}

export async function fetchConversations(
	workspaceId: string,
): Promise<{ data: Conversation[]; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/conversations?limit=100`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return {
			data: [],
			error: body?.error?.message ?? `HTTP ${res.status}`,
		};
	}
	const json = await res.json();
	return { data: json.data ?? [] };
}

export async function fetchMessages(
	workspaceId: string,
	conversationId: string,
): Promise<Message[]> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/messages?limit=100`,
		{
			headers: authHeaders(workspaceId),
			cache: "no-store",
		},
	);
	if (!res.ok) return [];
	const data = await res.json();
	return data.data ?? [];
}

export async function sendMessage(
	workspaceId: string,
	conversationId: string,
	body: string,
): Promise<Message | null> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/messages`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(workspaceId),
			},
			body: JSON.stringify({ body, sender_type: "agent" }),
		},
	);
	if (!res.ok) return null;
	return res.json();
}

export { API_URL };
