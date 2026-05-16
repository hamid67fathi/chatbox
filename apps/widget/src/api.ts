export interface WidgetConfig {
	apiUrl: string;
	workspaceSlug: string;
	workspaceId?: string;
	conversationId?: string;
	visitorId?: string;
}

export interface WidgetTheme {
	primary_color: string;
	position: "left" | "right";
	title: string;
	welcome_message: string;
	avatar_url: string | null;
}

export interface Message {
	id: string;
	body: string;
	senderType: string;
	createdAt: string;
}

interface SessionResponse {
	workspace_id: string;
	conversation_id: string;
	contact_id: string;
	token: string;
}

let visitorToken: string | null = null;

export function setVisitorToken(token: string) {
	visitorToken = token;
}

export function getVisitorToken() {
	return visitorToken;
}

export async function fetchWidgetTheme(
	config: WidgetConfig,
): Promise<WidgetTheme | null> {
	const url = new URL(`${config.apiUrl}/widget/v1/config`);
	url.searchParams.set("workspace_slug", config.workspaceSlug);
	const res = await fetch(url.toString());
	if (!res.ok) return null;
	return res.json();
}

export async function createSession(
	config: WidgetConfig,
): Promise<SessionResponse> {
	const res = await fetch(`${config.apiUrl}/widget/v1/sessions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			workspace_slug: config.workspaceSlug,
			visitor_id: config.visitorId ?? null,
		}),
	});
	if (!res.ok) throw new Error(`Session failed: ${res.status}`);
	const data = (await res.json()) as SessionResponse;
	setVisitorToken(data.token);
	return data;
}

function authHeaders(): HeadersInit {
	const h: Record<string, string> = { "Content-Type": "application/json" };
	if (visitorToken) h.Authorization = `Bearer ${visitorToken}`;
	return h;
}

export async function fetchMessages(
	config: WidgetConfig,
): Promise<Message[]> {
	const res = await fetch(`${config.apiUrl}/widget/v1/messages`, {
		headers: authHeaders(),
	});
	if (!res.ok) return [];
	const data = await res.json();
	const rows = data.data ?? [];
	return rows.map((m: Record<string, unknown>) => ({
		id: String(m.id),
		body: String(m.body ?? ""),
		senderType: String(m.senderType ?? m.sender_type ?? "system"),
		createdAt: String(m.createdAt ?? m.created_at ?? new Date().toISOString()),
	}));
}

export async function sendMessageHttp(
	config: WidgetConfig,
	body: string,
): Promise<Message> {
	const res = await fetch(`${config.apiUrl}/widget/v1/messages`, {
		method: "POST",
		headers: authHeaders(),
		body: JSON.stringify({ body }),
	});
	if (!res.ok) throw new Error(`Send failed: ${res.status}`);
	const m = await res.json();
	return {
		id: String(m.id),
		body: String(m.body ?? ""),
		senderType: String(m.senderType ?? m.sender_type ?? "contact"),
		createdAt: String(m.createdAt ?? m.created_at ?? new Date().toISOString()),
	};
}
