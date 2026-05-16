import { clearAuth, getAccessToken, refreshAccessToken } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Conversation {
	id: string;
	contactId: string;
	channel: string;
	status: string;
	subject: string | null;
	assignedAgentId?: string | null;
	assignedUserId?: string | null;
	priority?: number;
	lastMessageAt: string | null;
	lastAgentReplyAt?: string | null;
	createdAt: string;
	aiHandled?: boolean;
	needsHuman?: boolean;
	tags?: string[];
	contact?: {
		id: string;
		fullName: string;
		email: string | null;
	};
}

export interface ConversationNote {
	id: string;
	body: string;
	createdAt: string;
	author: {
		id: string;
		email: string;
		fullName: string | null;
	} | null;
}

export interface ConversationDetail extends Conversation {
	priority: number;
	assignedAgentId: string | null;
	tags: string[];
	notes: ConversationNote[];
}

export interface WorkspaceMember {
	userId: string;
	role: string;
	status?: string;
	email: string | null;
	fullName: string | null;
	joinedAt?: string | null;
}

export interface WorkspaceDetail {
	id: string;
	name: string;
	slug: string;
	plan: string;
	locale: string;
	timezone: string;
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
	replyToId?: string | null;
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
		replyToId: (raw.replyToId ?? raw.reply_to_id ?? null) as string | null,
	};
}

export async function fetchConversationDetail(
	workspaceId: string,
	conversationId: string,
): Promise<ConversationDetail | null> {
	const res = await authFetch(`${API_URL}/v1/conversations/${conversationId}`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return null;
	const raw = await res.json();
	return {
		id: raw.id,
		contactId: raw.contactId ?? raw.contact_id,
		channel: raw.channel,
		status: raw.status,
		subject: raw.subject,
		priority: raw.priority ?? 0,
		assignedAgentId: raw.assignedAgentId ?? raw.assigned_agent_id ?? null,
		lastMessageAt: raw.lastMessageAt ?? raw.last_message_at,
		createdAt: raw.createdAt ?? raw.created_at,
		contact: raw.contact,
		tags: raw.tags ?? [],
		notes: raw.notes ?? [],
	};
}

export async function fetchWorkspaceMembers(
	workspaceId: string,
): Promise<WorkspaceMember[]> {
	const res = await authFetch(`${API_URL}/v1/workspaces/${workspaceId}/members`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = await res.json();
	return json.data ?? [];
}

export async function fetchWorkspaceDetail(
	workspaceId: string,
): Promise<WorkspaceDetail | null> {
	const res = await authFetch(`${API_URL}/v1/workspaces/${workspaceId}`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return null;
	return res.json();
}

export async function updateWorkspace(
	workspaceId: string,
	data: { name?: string; locale?: string; timezone?: string },
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/workspaces/${workspaceId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify(data),
	});
	return res.ok;
}

export async function updateProfile(data: {
	full_name?: string;
	locale?: string;
	current_password?: string;
	new_password?: string;
}): Promise<{ ok: boolean; error?: string }> {
	const token = getAccessToken();
	const res = await authFetch(`${API_URL}/v1/auth/me`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	return { ok: true };
}

export async function inviteWorkspaceMember(
	workspaceId: string,
	data: { email: string; role: string; full_name?: string; password?: string },
): Promise<{
	ok: boolean;
	temporaryPassword?: string;
	error?: string;
}> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/members/invite`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
			body: JSON.stringify(data),
		},
	);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	return {
		ok: true,
		temporaryPassword: body.temporary_password,
	};
}

export async function updateMemberRole(
	workspaceId: string,
	userId: string,
	role: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/members/${userId}`,
		{
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
			body: JSON.stringify({ role }),
		},
	);
	return res.ok;
}

export async function removeWorkspaceMember(
	workspaceId: string,
	userId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/members/${userId}`,
		{
			method: "DELETE",
			headers: authHeaders(workspaceId),
		},
	);
	return res.ok;
}

export async function updateConversationStatus(
	workspaceId: string,
	conversationId: string,
	status: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/status`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
			body: JSON.stringify({ status }),
		},
	);
	return res.ok;
}

export async function assignConversation(
	workspaceId: string,
	conversationId: string,
	agentId: string | null,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/assign`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
			body: JSON.stringify({ agent_id: agentId }),
		},
	);
	return res.ok;
}

export async function updateConversationPriority(
	workspaceId: string,
	conversationId: string,
	priority: number,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/priority`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
			body: JSON.stringify({ priority }),
		},
	);
	return res.ok;
}

export async function addConversationTags(
	workspaceId: string,
	conversationId: string,
	tags: string[],
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/conversations/${conversationId}/tags`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify({ tags }),
	});
	return res.ok;
}

export async function addConversationNote(
	workspaceId: string,
	conversationId: string,
	body: string,
): Promise<ConversationNote | null> {
	const res = await authFetch(`${API_URL}/v1/conversations/${conversationId}/notes`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify({ body }),
	});
	if (!res.ok) return null;
	return res.json();
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
	replyToId?: string | null,
): Promise<Message | null> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/messages`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(workspaceId),
			},
			body: JSON.stringify({
				body,
				sender_type: "agent",
				...(replyToId ? { reply_to_id: replyToId } : {}),
			}),
		},
	);
	if (!res.ok) return null;
	const raw = await res.json();
	return normalizeMessage(raw as Record<string, unknown>);
}

export interface CannedResponse {
	id: string;
	shortcut: string;
	title: string;
	body: string;
	variables: string[] | null;
	usageCount: number;
	createdAt: string;
}

export async function fetchCannedResponses(
	workspaceId: string,
): Promise<CannedResponse[]> {
	const res = await authFetch(`${API_URL}/v1/canned-responses`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = await res.json();
	return json.data ?? [];
}

export async function createCannedResponse(
	workspaceId: string,
	data: { shortcut: string; title: string; body: string },
): Promise<CannedResponse | null> {
	const res = await authFetch(`${API_URL}/v1/canned-responses`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify(data),
	});
	if (!res.ok) return null;
	return res.json();
}

export async function updateCannedResponse(
	workspaceId: string,
	id: string,
	data: { shortcut?: string; title?: string; body?: string },
): Promise<CannedResponse | null> {
	const res = await authFetch(`${API_URL}/v1/canned-responses/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify(data),
	});
	if (!res.ok) return null;
	return res.json();
}

export async function deleteCannedResponse(
	workspaceId: string,
	id: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/canned-responses/${id}`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function useCannedResponse(
	workspaceId: string,
	id: string,
	variables: Record<string, string>,
): Promise<string | null> {
	const res = await authFetch(`${API_URL}/v1/canned-responses/${id}/use`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify({ variables }),
	});
	if (!res.ok) return null;
	const json = await res.json();
	return json.body ?? null;
}

export interface KnowledgeBase {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
}

export interface KbDocument {
	id: string;
	kbId: string;
	title: string | null;
	filePath: string | null;
	sourceType: string;
	status: "uploaded" | "processing" | "indexed" | "failed";
	sizeBytes: number | null;
	chunkCount: number;
	lastIndexedAt: string | null;
	errorMessage: string | null;
	createdAt: string;
}

export async function fetchKnowledgeBases(
	workspaceId: string,
): Promise<KnowledgeBase[]> {
	const res = await authFetch(`${API_URL}/v1/knowledge-bases`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = await res.json();
	return json.data ?? [];
}

export async function fetchKbDocuments(
	workspaceId: string,
	kbId: string,
): Promise<KbDocument[]> {
	const res = await authFetch(`${API_URL}/v1/knowledge-bases/${kbId}/documents`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = await res.json();
	return json.data ?? [];
}

export async function uploadKbDocument(
	workspaceId: string,
	kbId: string,
	data: { title?: string; filename: string; content: string },
): Promise<{ doc: KbDocument | null; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/knowledge-bases/${kbId}/documents`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify(data),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { doc: null, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	return { doc: body as KbDocument };
}

export async function deleteKbDocument(
	workspaceId: string,
	kbId: string,
	docId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/knowledge-bases/${kbId}/documents/${docId}`,
		{
			method: "DELETE",
			headers: authHeaders(workspaceId),
		},
	);
	return res.ok;
}

export async function reindexKbDocument(
	workspaceId: string,
	kbId: string,
	docId: string,
): Promise<{ doc: KbDocument | null; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/knowledge-bases/${kbId}/documents/${docId}/reindex`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { doc: null, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	return { doc: body as KbDocument };
}

export { API_URL };
