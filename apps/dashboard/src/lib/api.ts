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
	readAt?: string | null;
}

export interface ConversationsPage {
	limit: number;
	next_cursor: string | null;
	has_more: boolean;
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

export interface ConversationFilters {
	status?: string;
	channel?: string;
	assignedTo?: string;
	limit?: number;
	cursor?: string;
}

export async function fetchConversations(
	workspaceId: string,
	filters: ConversationFilters = {},
): Promise<{
	data: Conversation[];
	page?: ConversationsPage;
	error?: string;
}> {
	const params = new URLSearchParams({ limit: String(filters.limit ?? 30) });
	if (filters.status) params.set("status", filters.status);
	if (filters.channel) params.set("channel", filters.channel);
	if (filters.assignedTo) params.set("assigned_to", filters.assignedTo);
	if (filters.cursor) params.set("cursor", filters.cursor);

	const res = await authFetch(`${API_URL}/v1/conversations?${params}`, {
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
	return { data: json.data ?? [], page: json.page };
}

export function normalizeMessage(raw: Record<string, unknown>): Message {
	return {
		id: String(raw.id),
		conversationId: String(raw.conversationId ?? raw.conversation_id),
		senderType: String(raw.senderType ?? raw.sender_type),
		senderUserId: (raw.senderUserId ?? raw.sender_user_id ?? null) as string | null,
		senderContactId: (raw.senderContactId ?? raw.sender_contact_id ?? null) as
			| string
			| null,
		body: String(raw.body ?? ""),
		type: String(raw.type ?? "text"),
		createdAt: String(raw.createdAt ?? raw.created_at),
		readAt: (raw.readAt ?? raw.read_at ?? null) as string | null,
	};
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
	const rows = data.data ?? [];
	return rows.map((m: Record<string, unknown>) => normalizeMessage(m));
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
	const raw = await res.json();
	return normalizeMessage(raw as Record<string, unknown>);
}

export { API_URL };
