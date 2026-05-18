export interface AuthData {
	access_token: string;
	refresh_token: string;
	session_id: string;
	user: {
		id: string;
		email: string;
		full_name?: string;
		workspaces?: { id: string; role: string }[];
	};
}

export interface Conversation {
	id: string;
	channel: string;
	status: string;
	subject: string | null;
	lastMessageAt: string | null;
	contact?: {
		fullName?: string;
		full_name?: string;
		email?: string | null;
	};
}

export interface Message {
	id: string;
	body: string;
	senderType: string;
	createdAt: string;
}
