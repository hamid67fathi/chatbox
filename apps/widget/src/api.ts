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
	triggers?: {
		auto_open_delay_ms: number;
		auto_open_on_scroll_percent: number | null;
	};
	show_branding?: boolean;
	branding_label?: string;
	branding_url?: string;
}

export interface MessageAttachment {
	id?: string;
	url: string;
	name: string;
	mime_type: string;
	size_bytes: number;
	type: "image" | "file";
}

export interface Message {
	id: string;
	body: string;
	senderType: string;
	type?: string;
	attachments?: MessageAttachment[] | null;
	createdAt: string;
	readAt?: string | null;
	deliveredAt?: string | null;
}

function attachmentKind(
	o: Record<string, unknown>,
): "image" | "file" {
	if (o.type === "image") return "image";
	const mime = String(o.mime_type ?? o.mimeType ?? "");
	if (mime.startsWith("image/")) return "image";
	return "file";
}

function parseAttachments(raw: unknown): MessageAttachment[] | null {
	let data: unknown = raw;
	if (typeof data === "string") {
		try {
			data = JSON.parse(data) as unknown;
		} catch {
			return null;
		}
	}
	if (!data || !Array.isArray(data)) return null;
	const out: MessageAttachment[] = [];
	for (const item of data) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		if (typeof o.url !== "string" || !o.url) continue;
		out.push({
			id: typeof o.id === "string" ? o.id : undefined,
			url: o.url,
			name: String(o.name ?? "file"),
			mime_type: String(o.mime_type ?? o.mimeType ?? ""),
			size_bytes: Number(o.size_bytes ?? o.sizeBytes ?? 0),
			type: attachmentKind(o),
		});
	}
	return out.length > 0 ? out : null;
}

export function attachmentFullUrl(apiUrl: string, path: string) {
	if (path.startsWith("http")) return path;
	return `${apiUrl.replace(/\/$/, "")}${path}`;
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
	page?: {
		page_url?: string | null;
		page_title?: string | null;
		metadata?: Record<string, string>;
	},
): Promise<SessionResponse> {
	setApiBaseUrl(config.apiUrl);
	const res = await fetch(`${config.apiUrl}/widget/v1/sessions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			workspace_slug: config.workspaceSlug,
			visitor_id: config.visitorId ?? null,
			page_url: page?.page_url ?? null,
			page_title: page?.page_title ?? null,
			metadata: page?.metadata ?? {},
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

export async function updateVisitorContext(page?: {
	page_url?: string | null;
	page_title?: string | null;
	metadata?: Record<string, string>;
}): Promise<void> {
	const res = await fetch(`${apiBaseUrl}/widget/v1/visitor-context`, {
		method: "PATCH",
		headers: authHeaders(),
		body: JSON.stringify({
			page_url: page?.page_url ?? null,
			page_title: page?.page_title ?? null,
			metadata: page?.metadata ?? {},
		}),
	});
	if (!res.ok) {
		/* non-fatal */
	}
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
	return rows.map((m: Record<string, unknown>) => normalizeMessageRow(m));
}

function normalizeMessageRow(m: Record<string, unknown>): Message {
	return {
		id: String(m.id),
		body: String(m.body ?? ""),
		senderType: String(m.senderType ?? m.sender_type ?? "system"),
		type: String(m.type ?? "text"),
		attachments: parseAttachments(m.attachments),
		createdAt: String(m.createdAt ?? m.created_at ?? new Date().toISOString()),
		readAt: (m.readAt ?? m.read_at ?? null) as string | null,
		deliveredAt: (m.deliveredAt ?? m.delivered_at ?? null) as string | null,
	};
}

export async function uploadWidgetFile(file: File): Promise<MessageAttachment> {
	const form = new FormData();
	form.append("file", file);
	const res = await fetch(`${apiBaseUrl}/widget/v1/uploads`, {
		method: "POST",
		headers: visitorToken ? { Authorization: `Bearer ${visitorToken}` } : {},
		body: form,
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(
			(err as { error?: { message?: string } })?.error?.message ??
				`Upload failed: ${res.status}`,
		);
	}
	const data = (await res.json()).data as Record<string, unknown>;
	return {
		id: String(data.id ?? ""),
		url: String(data.url ?? ""),
		name: String(data.name ?? file.name),
		mime_type: String(data.mime_type ?? file.type),
		size_bytes: Number(data.size_bytes ?? file.size),
		type: data.type === "image" ? "image" : "file",
	};
}

export async function sendMessageHttp(
	config: WidgetConfig,
	body: string,
	options?: { type?: string; attachments?: MessageAttachment[] },
): Promise<Message> {
	const res = await fetch(`${config.apiUrl}/widget/v1/messages`, {
		method: "POST",
		headers: authHeaders(),
		body: JSON.stringify({
			body,
			...(options?.type ? { type: options.type } : {}),
			...(options?.attachments?.length
				? { attachments: options.attachments }
				: {}),
		}),
	});
	if (!res.ok) throw new Error(`Send failed: ${res.status}`);
	return normalizeMessageRow((await res.json()) as Record<string, unknown>);
}
