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

export async function fetchConversations(
	workspaceId: string,
): Promise<Conversation[]> {
	const res = await fetch(`${API_URL}/v1/conversations?limit=50`, {
		headers: { "X-Workspace-Id": workspaceId },
		cache: "no-store",
	});
	if (!res.ok) return [];
	const data = await res.json();
	return data.data ?? [];
}

export async function fetchMessages(
	workspaceId: string,
	conversationId: string,
): Promise<Message[]> {
	const res = await fetch(
		`${API_URL}/v1/conversations/${conversationId}/messages?limit=100`,
		{
			headers: { "X-Workspace-Id": workspaceId },
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
	const res = await fetch(
		`${API_URL}/v1/conversations/${conversationId}/messages`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Workspace-Id": workspaceId,
			},
			body: JSON.stringify({ body, sender_type: "agent" }),
		},
	);
	if (!res.ok) return null;
	return res.json();
}
