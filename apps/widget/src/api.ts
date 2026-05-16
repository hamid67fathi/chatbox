export interface WidgetConfig {
	apiUrl: string;
	workspaceSlug: string;
	workspaceId?: string;
	conversationId?: string;
	visitorId?: string;
}

export interface PrechatFieldConfig {
	enabled: boolean;
	required: boolean;
}

export interface WidgetTheme {
	primary_color: string;
	position: "left" | "right";
	title: string;
	welcome_message: string;
	avatar_url: string | null;
	prechat?: {
		enabled: boolean;
		fields: {
			name: PrechatFieldConfig;
			email: PrechatFieldConfig;
			phone: PrechatFieldConfig;
		};
	};
}

export interface Message {
	id: string;
	body: string;
	senderType: string;
	createdAt: string;
}

export interface SessionResponse {
	workspace_id: string;
	conversation_id: string;
	contact_id: string;
	visitor_id: string | null;
	token: string;
	profile_complete: boolean;
	contact: {
		full_name: string | null;
		email: string | null;
		phone: string | null;
	};
}

let visitorToken: string | null = null;
let apiBaseUrl = "";

export function setVisitorToken(token: string) {
	visitorToken = token;
}

export function setApiBaseUrl(url: string) {
	apiBaseUrl = url;
}

export function visitorStorageKey(workspaceSlug: string) {
	return `chatbox_visitor_${workspaceSlug}`;
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
	setApiBaseUrl(config.apiUrl);
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
	if (data.visitor_id) {
		try {
			localStorage.setItem(
				visitorStorageKey(config.workspaceSlug),
				data.visitor_id,
			);
		} catch {
			/* private mode */
		}
	}
	return data;
}

function authHeaders(): HeadersInit {
	const h: Record<string, string> = { "Content-Type": "application/json" };
	if (visitorToken) h.Authorization = `Bearer ${visitorToken}`;
	return h;
}

export async function updateContactProfile(data: {
	full_name?: string;
	email?: string;
	phone?: string;
}): Promise<{
	profile_complete: boolean;
	contact: SessionResponse["contact"];
}> {
	const res = await fetch(`${apiBaseUrl}/widget/v1/contact`, {
		method: "PATCH",
		headers: authHeaders(),
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			(err as { error?: { message?: string } })?.error?.message ??
				`Profile update failed: ${res.status}`,
		);
	}
	return res.json();
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
