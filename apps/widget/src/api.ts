export interface WidgetConfig {
	apiUrl: string;
	workspaceSlug: string;
	workspaceId?: string;
	conversationId?: string;
	visitorId?: string;
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
	return res.json();
}

export async function fetchMessages(
	config: WidgetConfig,
	conversationId: string,
	workspaceId: string,
): Promise<Message[]> {
	const res = await fetch(
		`${config.apiUrl}/v1/conversations/${conversationId}/messages?limit=50`,
		{ headers: { "X-Workspace-Id": workspaceId } },
	);
	if (!res.ok) return [];
	const data = await res.json();
	return data.data ?? [];
}

export async function sendMessageHttp(
	config: WidgetConfig,
	conversationId: string,
	workspaceId: string,
	contactId: string,
	body: string,
): Promise<Message> {
	const res = await fetch(
		`${config.apiUrl}/v1/conversations/${conversationId}/messages`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Workspace-Id": workspaceId,
			},
			body: JSON.stringify({
				body,
				sender_type: "contact",
				sender_contact_id: contactId,
			}),
		},
	);
	if (!res.ok) throw new Error(`Send failed: ${res.status}`);
	return res.json();
}
