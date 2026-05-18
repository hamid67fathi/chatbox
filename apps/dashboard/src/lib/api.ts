import { clearAuth, getAccessToken, refreshAccessToken } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function publicAssetUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = API_URL.replace(/\/$/, "");
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

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
	sentimentScore?: string | number | null;
	summary?: string | null;
	metadata?: Record<string, unknown> | null;
	tags?: string[];
	sla?: SlaStatus;
	contact?: {
		id: string;
		fullName: string;
		email: string | null;
		metadata?: Record<string, unknown> | null;
	};
}

export type SlaMetricState =
	| "pending"
	| "ok"
	| "warning"
	| "breached"
	| "disabled";

export interface SlaStatus {
	enabled: boolean;
	first_response: SlaMetricState;
	resolution: SlaMetricState;
	first_response_due_at: string | null;
	resolution_due_at: string | null;
	first_response_remaining_sec: number | null;
	resolution_remaining_sec: number | null;
}

export interface SlaPolicy {
	enabled: boolean;
	first_response_minutes: number;
	resolution_minutes: number;
	warn_at_percent: number;
}

export interface SlaViolationRow {
	conversation_id: string;
	created_at: string;
	status: string;
	channel: string;
	first_response_breached: boolean;
	resolution_breached: boolean;
	first_response_at: string | null;
	resolved_at: string | null;
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

export interface VisitorPageView {
	url: string;
	title?: string | null;
	at: string;
}

export interface VisitorInfo {
	ip?: string | null;
	country?: string | null;
	country_code?: string | null;
	countryCode?: string | null;
	current_page_url?: string | null;
	currentPageUrl?: string | null;
	current_page_url_at?: string | null;
	currentPageUrlAt?: string | null;
	browser?: string | null;
	os?: string | null;
	device?: string | null;
	utm?: Record<string, string>;
	updated_at?: string | null;
	updatedAt?: string | null;
	page_views?: VisitorPageView[];
}

export interface HandoffBrief {
	summary: string;
	key_points: string[];
	suggested_reply: string;
	generated_at: string;
	context?: {
		channel?: string;
		contact_name?: string | null;
		tags?: string[];
		subject?: string | null;
	};
}

export interface ConversationDetail extends Conversation {
	priority: number;
	assignedAgentId: string | null;
	tags: string[];
	notes: ConversationNote[];
	visitor?: VisitorInfo | null;
	handoff_brief?: HandoffBrief | null;
}

export interface WorkspaceMember {
	userId: string;
	role: string;
	status?: string;
	email: string | null;
	fullName: string | null;
	avatarUrl?: string | null;
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

export interface AiBudgetStatus {
	plan: string;
	monthlyLimit: number | null;
	bonusCredits: number;
	totalLimit: number | null;
	usedCredits: number;
	remainingCredits: number | null;
	percentUsed: number | null;
	level: "ok" | "warning" | "exhausted" | "unlimited";
	periodStart: string;
	allowAi: boolean;
}

export interface UsageMetric {
	key: string;
	label: string;
	used: number;
	limit: number | null;
	remaining: number | null;
	percentUsed: number | null;
	level: "ok" | "warning" | "exhausted" | "unlimited";
	unit: "count" | "bytes" | "credits";
}

export interface PlanUsageStatus {
	plan: string;
	periodStart: string;
	members: UsageMetric;
	conversationsMonth: UsageMetric;
	uploadBytesMonth: UsageMetric;
	ai: AiBudgetStatus | null;
	allowInviteMember: boolean;
	allowNewConversation: boolean;
	allowUpload: boolean;
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
	conversationId: string;
	senderType: string;
	senderUserId: string | null;
	senderContactId: string | null;
	body: string;
	type: string;
	attachments?: MessageAttachment[] | null;
	createdAt: string;
	readAt?: string | null;
	deliveredAt?: string | null;
	replyToId?: string | null;
	sentimentScore?: number | null;
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
	/** false = inbox (default), true = archived only, all = include archived */
	archived?: "true" | "false" | "all";
}

export interface PresenceCounts {
	agents_online: number;
	visitors_online: number;
}

export interface OnlineVisitorRow {
	contact_id: string;
	full_name: string | null;
	ip: string | null;
	country: string | null;
	country_code: string | null;
	device: string | null;
	visit_count: number;
	connected_at: string;
	duration_sec: number;
	current_page_url: string | null;
	current_page_title: string | null;
	conversation_id: string | null;
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
	if (filters.archived) params.set("archived", filters.archived);

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

function parseAttachments(raw: unknown): MessageAttachment[] | null {
	if (!raw || !Array.isArray(raw)) return null;
	const out: MessageAttachment[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		if (typeof o.url !== "string") continue;
		out.push({
			id: typeof o.id === "string" ? o.id : undefined,
			url: o.url,
			name: String(o.name ?? "file"),
			mime_type: String(o.mime_type ?? o.mimeType ?? ""),
			size_bytes: Number(o.size_bytes ?? o.sizeBytes ?? 0),
			type: o.type === "image" ? "image" : "file",
		});
	}
	return out.length > 0 ? out : null;
}

export function attachmentUrl(path: string) {
	if (path.startsWith("http")) return path;
	return `${API_URL}${path}`;
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
		attachments: parseAttachments(raw.attachments),
		createdAt: String(raw.createdAt ?? raw.created_at),
		readAt: (raw.readAt ?? raw.read_at ?? null) as string | null,
		deliveredAt: (raw.deliveredAt ?? raw.delivered_at ?? null) as string | null,
		replyToId: (raw.replyToId ?? raw.reply_to_id ?? null) as string | null,
		sentimentScore: parseMessageSentiment(raw.reactions),
	};
}

function parseMessageSentiment(reactions: unknown): number | null {
	if (!reactions || typeof reactions !== "object") return null;
	const s = (reactions as { sentiment?: unknown }).sentiment;
	if (typeof s === "number") return s;
	if (typeof s === "string") {
		const n = Number.parseFloat(s);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

export async function refreshConversationSummary(
	workspaceId: string,
	conversationId: string,
): Promise<{ summary: string | null; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/summary`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			summary: null,
			error: body?.error?.message ?? `HTTP ${res.status}`,
		};
	}
	return { summary: body?.data?.summary ?? null };
}

export async function fetchHandoffBrief(
	workspaceId: string,
	conversationId: string,
): Promise<HandoffBrief | null> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/handoff-brief`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: HandoffBrief | null };
	return json.data ?? null;
}

export async function refreshHandoffBrief(
	workspaceId: string,
	conversationId: string,
): Promise<HandoffBrief | null> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/handoff-brief`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: HandoffBrief | null };
	return json.data ?? null;
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
		aiHandled: raw.aiHandled ?? raw.ai_handled,
		needsHuman: (raw.aiHandled ?? raw.ai_handled) === false,
		sentimentScore: raw.sentimentScore ?? raw.sentiment_score ?? null,
		summary: raw.summary ?? null,
		handoff_brief: raw.handoff_brief ?? raw.handoffBrief ?? null,
		metadata:
			typeof raw.metadata === "object" && raw.metadata
				? (raw.metadata as Record<string, unknown>)
				: null,
		visitor: raw.visitor ?? null,
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

export interface BillingPlan {
	name: string;
	price_rial: number;
	price_display: string;
	trial_days?: number;
	contact_sales?: boolean;
}

export interface SubscriptionInfo {
	id: string;
	plan: string;
	status: string;
	periodStart: string | null;
	periodEnd: string | null;
}

export async function fetchBillingPlans(
	workspaceId: string,
): Promise<BillingPlan[]> {
	const res = await authFetch(`${API_URL}/v1/billing/plans`, {
		headers: authHeaders(workspaceId),
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { plans?: BillingPlan[] };
	return json.plans ?? [];
}

export interface BillingStatus {
	subscription: SubscriptionInfo | null;
	workspace_plan: string;
	trial_ends_at: string | null;
}

export async function fetchBillingStatus(
	workspaceId: string,
): Promise<BillingStatus | null> {
	const res = await authFetch(
		`${API_URL}/v1/billing/${workspaceId}/subscription`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return null;
	return res.json() as Promise<BillingStatus>;
}

export async function startProTrial(
	workspaceId: string,
): Promise<{ trial_ends_at?: string; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/billing/${workspaceId}/trial`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	const json = (await res.json()) as {
		trial_ends_at?: string;
		error?: { message?: string };
	};
	if (!res.ok) return { error: json.error?.message ?? "خطا در فعال‌سازی آزمایشی" };
	return { trial_ends_at: json.trial_ends_at };
}

export async function cancelSubscription(
	workspaceId: string,
): Promise<{ ok?: boolean; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/billing/${workspaceId}/cancel`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	const json = (await res.json()) as { error?: { message?: string } };
	if (!res.ok) return { error: json.error?.message ?? "خطا در لغو اشتراک" };
	return { ok: true };
}

export interface PaymentRow {
	id: string;
	amount_rial: number;
	status: string;
	provider_ref_id: string | null;
	paid_at: string | null;
	invoice_url: string | null;
}

export async function fetchBillingPayments(
	workspaceId: string,
): Promise<PaymentRow[]> {
	const res = await authFetch(
		`${API_URL}/v1/billing/${workspaceId}/payments`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: PaymentRow[] };
	return json.data ?? [];
}

export async function downloadInvoicePdf(
	workspaceId: string,
	paymentId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/billing/payments/${paymentId}/invoice`,
		{ headers: authHeaders(workspaceId) },
	);
	if (!res.ok) return false;
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `chatbox-invoice-${paymentId.slice(0, 8)}.pdf`;
	a.click();
	URL.revokeObjectURL(url);
	return true;
}

export async function startBillingCheckout(
	workspaceId: string,
	plan: string,
): Promise<{ redirect_url?: string; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/billing/${workspaceId}/checkout`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(workspaceId),
			},
			body: JSON.stringify({ plan }),
		},
	);
	const json = (await res.json()) as {
		redirect_url?: string;
		error?: { message?: string };
	};
	if (!res.ok) {
		return { error: json.error?.message ?? "خطا در شروع پرداخت" };
	}
	return { redirect_url: json.redirect_url };
}

export async function fetchAiUsage(
	workspaceId: string,
): Promise<AiBudgetStatus | null> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/ai-usage`,
		{
			headers: authHeaders(workspaceId),
			cache: "no-store",
		},
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: AiBudgetStatus };
	return json.data ?? null;
}

export async function fetchPlanUsage(
	workspaceId: string,
): Promise<PlanUsageStatus | null> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/plan-usage`,
		{
			headers: authHeaders(workspaceId),
			cache: "no-store",
		},
	);
	if (!res.ok) return null;
	const json = (await res.json()) as {
		data?: PlanUsageStatus & {
			conversations_month?: UsageMetric;
			upload_bytes_month?: UsageMetric;
		};
	};
	const raw = json.data;
	if (!raw) return null;
	return {
		...raw,
		conversationsMonth:
			raw.conversationsMonth ?? raw.conversations_month!,
		uploadBytesMonth: raw.uploadBytesMonth ?? raw.upload_bytes_month!,
	};
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

export async function uploadUserAvatar(
	file: File,
): Promise<{ ok: boolean; avatar_url?: string | null; error?: string }> {
	const token = getAccessToken();
	const form = new FormData();
	form.append("file", file);
	const res = await authFetch(`${API_URL}/v1/auth/me/avatar`, {
		method: "POST",
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: form,
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			ok: false,
			error: (body as { error?: { message?: string } })?.error?.message,
		};
	}
	const user = (body as { user?: { avatar_url?: string | null } }).user;
	return { ok: true, avatar_url: user?.avatar_url ?? null };
}

export async function removeUserAvatar(): Promise<{
	ok: boolean;
	error?: string;
}> {
	const token = getAccessToken();
	const res = await authFetch(`${API_URL}/v1/auth/me/avatar`, {
		method: "DELETE",
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return {
			ok: false,
			error: (body as { error?: { message?: string } })?.error?.message,
		};
	}
	return { ok: true };
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

export async function archiveConversation(
	workspaceId: string,
	conversationId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/archive`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	return res.ok;
}

export async function unarchiveConversation(
	workspaceId: string,
	conversationId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/unarchive`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	return res.ok;
}

export async function banConversationContact(
	workspaceId: string,
	conversationId: string,
	reason?: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/ban-contact`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(workspaceId),
			},
			body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
		},
	);
	return res.ok;
}

export async function unbanConversationContact(
	workspaceId: string,
	conversationId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/unban-contact`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	return res.ok;
}

export function isContactBanned(metadata: unknown): boolean {
	if (!metadata || typeof metadata !== "object") return false;
	const m = metadata as { bannedAt?: string };
	return typeof m.bannedAt === "string" && m.bannedAt.length > 0;
}

export async function fetchBannedIps(workspaceId: string): Promise<string[]> {
	const res = await authFetch(`${API_URL}/v1/security/banned-ips`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: string[] };
	return json.data ?? [];
}

export async function updateBannedIps(
	workspaceId: string,
	ips: string[],
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/security/banned-ips`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({ ips }),
	});
	return res.ok;
}

export async function fetchDashboardIpWhitelist(
	workspaceId: string,
): Promise<string[]> {
	const res = await authFetch(
		`${API_URL}/v1/security/dashboard-ip-whitelist`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: string[] };
	return json.data ?? [];
}

export async function updateDashboardIpWhitelist(
	workspaceId: string,
	ips: string[],
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/security/dashboard-ip-whitelist`,
		{
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(workspaceId),
			},
			body: JSON.stringify({ ips }),
		},
	);
	return res.ok;
}

export async function fetchRequire2fa(
	workspaceId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/security/require-2fa`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return false;
	const json = (await res.json()) as { data?: { enabled?: boolean } };
	return json.data?.enabled === true;
}

export async function updateRequire2fa(
	workspaceId: string,
	enabled: boolean,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/security/require-2fa`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({ enabled }),
	});
	return res.ok;
}

export interface TwoFactorStatus {
	enabled: boolean;
	has_password: boolean;
}

export async function fetchTwoFactorStatus(): Promise<TwoFactorStatus | null> {
	const res = await authFetch(`${API_URL}/v1/auth/2fa/status`, {
		cache: "no-store",
	});
	if (!res.ok) return null;
	return (await res.json()) as TwoFactorStatus;
}

export interface TwoFactorSetupResult {
	secret: string;
	otpauth_url: string;
	qr_data_url: string;
}

export async function setupTwoFactor(): Promise<TwoFactorSetupResult | null> {
	const res = await authFetch(`${API_URL}/v1/auth/2fa/setup`, {
		method: "POST",
	});
	if (!res.ok) return null;
	return (await res.json()) as TwoFactorSetupResult;
}

export async function verifyTwoFactorSetup(
	code: string,
): Promise<{ recovery_codes?: string[] } | null> {
	const res = await authFetch(`${API_URL}/v1/auth/2fa/verify`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code }),
	});
	if (!res.ok) return null;
	return (await res.json()) as { recovery_codes?: string[] };
}

export async function disableTwoFactor(body: {
	code?: string;
	recovery_code?: string;
	password?: string;
}): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/auth/2fa/disable`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return res.ok;
}

export interface TelegramIntegrationPublic {
	type: "telegram";
	enabled: boolean;
	bot_id: number;
	bot_username: string;
	connected_at: string;
	webhook_url: string;
	token_masked: string;
}

export interface EmailIntegrationPublic {
	type: "email";
	enabled: boolean;
	from_address: string;
	from_name: string | null;
	imap_host: string;
	smtp_host: string;
	connected_at: string;
	imap_user_masked: string;
}

export interface WhatsappIntegrationPublic {
	type: "whatsapp";
	enabled: boolean;
	phone_number_id: string;
	display_phone_number: string | null;
	connected_at: string;
	webhook_url: string;
	verify_token: string;
	token_masked: string;
}

export type IntegrationPublic =
	| TelegramIntegrationPublic
	| EmailIntegrationPublic
	| WhatsappIntegrationPublic;

export async function fetchIntegrations(
	workspaceId: string,
): Promise<IntegrationPublic[]> {
	const res = await authFetch(`${API_URL}/v1/integrations`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: IntegrationPublic[] };
	return json.data ?? [];
}

export interface EmailConnectPayload {
	imap_host: string;
	imap_port: number;
	imap_secure: boolean;
	imap_user: string;
	imap_password: string;
	smtp_host: string;
	smtp_port: number;
	smtp_secure: boolean;
	smtp_user: string;
	smtp_password: string;
	from_address: string;
	from_name?: string | null;
}

export async function connectEmailIntegration(
	workspaceId: string,
	payload: EmailConnectPayload,
): Promise<{ ok: boolean; data?: EmailIntegrationPublic; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/integrations/email`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return {
			ok: false,
			error: json.error?.message ?? "اتصال ایمیل ناموفق بود.",
		};
	}
	const json = (await res.json()) as { data?: EmailIntegrationPublic };
	return { ok: true, data: json.data };
}

export async function testEmailIntegration(workspaceId: string): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/integrations/email/test`, {
		method: "POST",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function disconnectEmailIntegration(
	workspaceId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/integrations/email`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function connectTelegramBot(
	workspaceId: string,
	botToken: string,
): Promise<{ ok: boolean; data?: TelegramIntegrationPublic; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/integrations/telegram`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({ bot_token: botToken }),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return {
			ok: false,
			error: json.error?.message ?? "اتصال ربات تلگرام ناموفق بود.",
		};
	}
	const json = (await res.json()) as { data?: TelegramIntegrationPublic };
	return { ok: true, data: json.data };
}

export async function disconnectTelegramBot(
	workspaceId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/integrations/telegram`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function connectWhatsappIntegration(
	workspaceId: string,
	payload: {
		phone_number_id: string;
		access_token: string;
		verify_token?: string;
	},
): Promise<{ ok: boolean; data?: WhatsappIntegrationPublic; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/integrations/whatsapp`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return {
			ok: false,
			error: json.error?.message ?? "اتصال واتساپ ناموفق بود.",
		};
	}
	const json = (await res.json()) as { data?: WhatsappIntegrationPublic };
	return { ok: true, data: json.data };
}

export async function disconnectWhatsappIntegration(
	workspaceId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/integrations/whatsapp`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function banConversationIp(
	workspaceId: string,
	conversationId: string,
): Promise<{ ok: boolean; ip?: string; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/ban-ip`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "مسدود کردن IP ناموفق بود." };
	}
	const json = (await res.json()) as { ip?: string };
	return { ok: true, ip: json.ip };
}

export async function fetchPresence(
	workspaceId: string,
): Promise<PresenceCounts | null> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/presence`,
		{
			headers: authHeaders(workspaceId),
			cache: "no-store",
		},
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: PresenceCounts };
	return json.data ?? null;
}

export async function fetchOnlineVisitors(
	workspaceId: string,
): Promise<OnlineVisitorRow[]> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/presence/visitors`,
		{
			headers: authHeaders(workspaceId),
			cache: "no-store",
		},
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: OnlineVisitorRow[] };
	return json.data ?? [];
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

export interface AiTagResult {
	ok: boolean;
	tags: string[];
	applied: string[];
	model?: string;
	skipped?: string;
}

export interface AiPersona {
	enabled: boolean;
	name: string | null;
	tone: "formal" | "friendly" | "technical";
	custom_instructions: string;
}

export async function fetchAiPersona(
	workspaceId: string,
): Promise<AiPersona | null> {
	const res = await authFetch(`${API_URL}/v1/ai-persona`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: AiPersona };
	return json.data ?? null;
}

export async function updateAiPersona(
	workspaceId: string,
	persona: Partial<AiPersona>,
): Promise<{ ok: boolean; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/ai-persona`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(persona),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	return { ok: true };
}

export async function previewAiPersona(
	workspaceId: string,
	opts: {
		question?: string;
		persona?: Partial<AiPersona>;
	},
): Promise<{ reply: string; language: string; model: string } | null> {
	const res = await authFetch(`${API_URL}/v1/ai/persona/preview`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({
			question: opts.question,
			persona: opts.persona,
		}),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as {
		data?: { reply: string; language: string; model: string };
	};
	return json.data ?? null;
}

export async function requestConversationAiTags(
	workspaceId: string,
	conversationId: string,
	opts?: { force?: boolean; apply?: boolean },
): Promise<AiTagResult | null> {
	const res = await authFetch(`${API_URL}/v1/ai/tag`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
		body: JSON.stringify({
			conversation_id: conversationId,
			force: opts?.force === true,
			apply: opts?.apply !== false,
		}),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: AiTagResult };
	return json.data ?? null;
}

export function getAiSuggestedTags(metadata: unknown): string[] {
	if (!metadata || typeof metadata !== "object") return [];
	const raw = (metadata as Record<string, unknown>).ai_tagging;
	if (!raw || typeof raw !== "object") return [];
	const tags = (raw as { tags?: unknown }).tags;
	if (!Array.isArray(tags)) return [];
	return tags.filter((t): t is string => typeof t === "string");
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

export async function uploadMessageFile(
	workspaceId: string,
	file: File,
): Promise<{ attachment: MessageAttachment | null; error?: string }> {
	const form = new FormData();
	form.append("file", file);
	const res = await authFetch(`${API_URL}/v1/uploads`, {
		method: "POST",
		headers: authHeaders(workspaceId),
		body: form,
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			attachment: null,
			error: body?.error?.message ?? `HTTP ${res.status}`,
		};
	}
	const data = body.data as Record<string, unknown>;
	return {
		attachment: {
			id: String(data.id ?? ""),
			url: String(data.url ?? ""),
			name: String(data.name ?? file.name),
			mime_type: String(data.mime_type ?? file.type),
			size_bytes: Number(data.size_bytes ?? file.size),
			type: data.type === "image" ? "image" : "file",
		},
	};
}

export async function sendMessage(
	workspaceId: string,
	conversationId: string,
	body: string,
	replyToId?: string | null,
	options?: {
		type?: string;
		attachments?: MessageAttachment[];
	},
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
				...(options?.type ? { type: options.type } : {}),
				...(options?.attachments?.length
					? { attachments: options.attachments }
					: {}),
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

export interface PrechatFieldPublic {
	enabled: boolean;
	required: boolean;
}

export interface WidgetConfigPublic {
	primary_color: string;
	position: "left" | "right";
	title: string;
	welcome_message: string;
	avatar_url: string | null;
	prechat?: {
		enabled: boolean;
		fields: {
			name: PrechatFieldPublic;
			email: PrechatFieldPublic;
			phone: PrechatFieldPublic;
		};
	};
	triggers?: {
		auto_open_delay_ms: number;
		auto_open_on_scroll_percent: number | null;
	};
	csat?: {
		enabled: boolean;
		prompt_message: string;
		ask_comment: boolean;
	};
	auto_tagging?: {
		enabled: boolean;
		auto_apply: boolean;
	};
	ai_languages?: {
		default_language: "fa" | "en" | "ar";
		translate_kb: boolean;
	};
	business_hours?: {
		enabled: boolean;
		is_open?: boolean;
		show_status?: boolean;
		status_label?: string;
		away_message?: string | null;
		timezone: string;
		schedule?: Record<
			string,
			{ enabled: boolean; start: string; end: string }
		>;
		holidays?: string[];
	};
}

export async function fetchWidgetConfig(
	workspaceId: string,
): Promise<WidgetConfigPublic | null> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/widget-config`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return null;
	const json = await res.json();
	return json.data ?? null;
}

export async function updateWidgetConfig(
	workspaceId: string,
	data: Partial<WidgetConfigPublic> & Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/widget-config`,
		{
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...authHeaders(workspaceId) },
			body: JSON.stringify(data),
		},
	);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	return { ok: true };
}

export interface CopilotSuggestion {
	style: string;
	label: string;
	text: string;
}

export type CopilotStreamEvent =
	| { type: "meta"; model?: string }
	| {
			type: "suggestion";
			index: number;
			style: string;
			label: string;
			text: string;
	  }
	| { type: "done"; input_tokens?: number; output_tokens?: number }
	| { type: "error"; message?: string };

export async function streamCopilotSuggestions(
	workspaceId: string,
	conversationId: string,
	onEvent: (event: CopilotStreamEvent) => void,
	signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/conversations/${conversationId}/copilot/stream`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(workspaceId),
			},
			body: "{}",
			signal,
		},
	);

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return {
			ok: false,
			error: body?.error?.message ?? `HTTP ${res.status}`,
		};
	}

	if (!res.body) {
		return { ok: false, error: "پاسخ خالی از سرور." };
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split("\n\n");
			buffer = parts.pop() ?? "";
			for (const part of parts) {
				for (const line of part.split("\n")) {
					if (!line.startsWith("data: ")) continue;
					try {
						onEvent(JSON.parse(line.slice(6)) as CopilotStreamEvent);
					} catch {
						/* skip */
					}
				}
			}
		}
		return { ok: true };
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			return { ok: false, error: "لغو شد." };
		}
		return { ok: false, error: (err as Error).message };
	}
}

export interface ApiTokenRow {
	id: string;
	name: string;
	token_prefix: string;
	created_by: string;
	creator_email: string | null;
	last_used_at: string | null;
	expires_at: string | null;
	created_at: string;
}

export async function fetchApiTokens(
	workspaceId: string,
): Promise<ApiTokenRow[]> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/api-tokens`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return [];
	const body = await res.json().catch(() => ({}));
	return body.data ?? [];
}

export async function createApiToken(
	workspaceId: string,
	data: { name: string; expires_in_days?: number },
): Promise<{
	ok: boolean;
	token?: string;
	token_prefix?: string;
	id?: string;
	error?: string;
}> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/api-tokens`,
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
		token: body.token,
		token_prefix: body.token_prefix,
		id: body.id,
	};
}

export async function revokeApiToken(
	workspaceId: string,
	tokenId: string,
): Promise<boolean> {
	const res = await authFetch(
		`${API_URL}/v1/workspaces/${workspaceId}/api-tokens/${tokenId}`,
		{ method: "DELETE", headers: authHeaders(workspaceId) },
	);
	return res.ok;
}

export interface ConversationReportRow {
	id: string;
	status: string;
	channel: string;
	subject: string | null;
	created_at: string;
	last_message_at: string | null;
	closed_at: string | null;
	csat_score: number | null;
	first_response_sec: number | null;
	message_count: number;
	archived: boolean;
	contact: {
		full_name?: string | null;
		fullName?: string | null;
		email?: string | null;
		phone?: string | null;
	} | null;
	assigned_agent: {
		email?: string | null;
		full_name?: string | null;
		fullName?: string | null;
	} | null;
	tags: string[];
}

export interface ConversationReportFilters {
	from: string;
	to: string;
	status?: string;
	channel?: string;
	assignedTo?: string;
	archived?: "true" | "false" | "all";
	tag?: string;
	q?: string;
	limit?: number;
	offset?: number;
}

function reportSearchParams(filters: ConversationReportFilters): URLSearchParams {
	const params = new URLSearchParams({
		from: filters.from,
		to: filters.to,
	});
	if (filters.status) params.set("status", filters.status);
	if (filters.channel) params.set("channel", filters.channel);
	if (filters.assignedTo) params.set("assigned_to", filters.assignedTo);
	if (filters.archived) params.set("archived", filters.archived);
	if (filters.tag) params.set("tag", filters.tag);
	if (filters.q) params.set("q", filters.q);
	if (filters.limit != null) params.set("limit", String(filters.limit));
	if (filters.offset != null) params.set("offset", String(filters.offset));
	return params;
}

export async function fetchConversationReport(
	workspaceId: string,
	filters: ConversationReportFilters,
): Promise<{
	data: ConversationReportRow[];
	total: number;
	hasMore: boolean;
	error?: string;
}> {
	const params = reportSearchParams(filters);
	const res = await authFetch(
		`${API_URL}/v1/reports/conversations?${params}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			data: [],
			total: 0,
			hasMore: false,
			error: body?.error?.message ?? `HTTP ${res.status}`,
		};
	}
	return {
		data: body.data ?? [],
		total: body.page?.total ?? 0,
		hasMore: Boolean(body.page?.has_more),
	};
}

export async function downloadConversationReportCsv(
	workspaceId: string,
	filters: ConversationReportFilters,
): Promise<{ ok: boolean; truncated?: boolean; error?: string }> {
	const params = reportSearchParams(filters);
	params.set("format", "csv");
	const res = await authFetch(
		`${API_URL}/v1/reports/conversations/export?${params}`,
		{ headers: authHeaders(workspaceId) },
	);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
	}
	const truncated = res.headers.get("X-Export-Truncated") === "true";
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	const from = filters.from.slice(0, 10);
	const to = filters.to.slice(0, 10);
	a.download = `chatbox-conversations-${from}_${to}.csv`;
	a.click();
	URL.revokeObjectURL(url);
	return { ok: true, truncated };
}

export type FlowNodeType =
	| "start"
	| "message"
	| "question"
	| "condition"
	| "handoff";

export interface FlowDefinition {
	nodes: Array<{
		id: string;
		type: FlowNodeType;
		position?: { x: number; y: number };
		data: Record<string, unknown>;
	}>;
	edges: Array<{
		id: string;
		source: string;
		target: string;
		sourceHandle?: string | null;
	}>;
}

export interface FlowRecord {
	id: string;
	workspaceId: string;
	name: string;
	status: string;
	trigger: string;
	definition: FlowDefinition;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export async function fetchFlows(workspaceId: string): Promise<FlowRecord[]> {
	const res = await authFetch(`${API_URL}/v1/flows`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: FlowRecord[] };
	return json.data ?? [];
}

export async function createFlow(
	workspaceId: string,
	name?: string,
): Promise<FlowRecord | null> {
	const res = await authFetch(`${API_URL}/v1/flows`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({ name }),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: FlowRecord };
	return json.data ?? null;
}

export async function updateFlow(
	workspaceId: string,
	flowId: string,
	payload: { name?: string; definition?: FlowDefinition },
): Promise<{ ok: boolean; data?: FlowRecord; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/flows/${flowId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "ذخیره جریان ناموفق بود." };
	}
	const json = (await res.json()) as { data?: FlowRecord };
	return { ok: true, data: json.data };
}

export async function publishFlow(
	workspaceId: string,
	flowId: string,
): Promise<{ ok: boolean; data?: FlowRecord; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/flows/${flowId}/publish`, {
		method: "POST",
		headers: authHeaders(workspaceId),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "انتشار ناموفق بود." };
	}
	const json = (await res.json()) as { data?: FlowRecord };
	return { ok: true, data: json.data };
}

export async function unpublishFlow(
	workspaceId: string,
	flowId: string,
): Promise<{ ok: boolean; data?: FlowRecord; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/flows/${flowId}/unpublish`, {
		method: "POST",
		headers: authHeaders(workspaceId),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "لغو انتشار ناموفق بود." };
	}
	const json = (await res.json()) as { data?: FlowRecord };
	return { ok: true, data: json.data };
}

export async function deleteFlow(
	workspaceId: string,
	flowId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/flows/${flowId}`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export type RoutingActionType =
	| "assign_agent"
	| "round_robin"
	| "enable_ai"
	| "set_priority";

export interface RoutingRule {
	id: string;
	workspaceId: string;
	name: string;
	enabled: boolean;
	priority: number;
	conditions: {
		channels?: string[];
		keywords?: string[];
		keyword_mode?: "any" | "all";
		segment_id?: string;
	};
	action: {
		type: RoutingActionType;
		agent_id?: string;
		agent_ids?: string[];
		priority?: number;
	};
	createdAt: string;
	updatedAt: string;
}

export async function fetchRoutingRules(
	workspaceId: string,
): Promise<RoutingRule[]> {
	const res = await authFetch(`${API_URL}/v1/routing-rules`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: RoutingRule[] };
	return json.data ?? [];
}

export async function createRoutingRule(
	workspaceId: string,
	payload: {
		name: string;
		priority?: number;
		conditions?: RoutingRule["conditions"];
		action?: RoutingRule["action"];
	},
): Promise<RoutingRule | null> {
	const res = await authFetch(`${API_URL}/v1/routing-rules`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: RoutingRule };
	return json.data ?? null;
}

export async function updateRoutingRule(
	workspaceId: string,
	ruleId: string,
	payload: Partial<{
		name: string;
		enabled: boolean;
		priority: number;
		conditions: RoutingRule["conditions"];
		action: RoutingRule["action"];
	}>,
): Promise<{ ok: boolean; data?: RoutingRule; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/routing-rules/${ruleId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "ذخیره قانون ناموفق بود." };
	}
	const json = (await res.json()) as { data?: RoutingRule };
	return { ok: true, data: json.data };
}

export async function deleteRoutingRule(
	workspaceId: string,
	ruleId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/routing-rules/${ruleId}`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export interface SegmentFilters {
	channels?: string[];
	tags?: string[];
	tag_mode?: "any" | "all";
	min_conversations?: number;
	max_conversations?: number;
	last_seen_after?: string;
	last_seen_before?: string;
}

export interface ContactSegment {
	id: string;
	workspaceId: string;
	name: string;
	description: string | null;
	filters: SegmentFilters;
	isDynamic: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface SegmentPreview {
	count: number;
	sample: Array<{
		id: string;
		fullName: string | null;
		email: string | null;
		lastSeenAt: string;
		tags: string[];
	}>;
}

function mapContactSegment(raw: Record<string, unknown>): ContactSegment {
	return {
		id: String(raw.id),
		workspaceId: String(raw.workspaceId ?? raw.workspace_id),
		name: String(raw.name),
		description:
			raw.description != null ? String(raw.description) : null,
		filters: (raw.filters as SegmentFilters) ?? {},
		isDynamic: Boolean(raw.isDynamic ?? raw.is_dynamic ?? true),
		createdAt: String(raw.createdAt ?? raw.created_at),
		updatedAt: String(raw.updatedAt ?? raw.updated_at),
	};
}

export interface Contact {
	id: string;
	workspaceId: string;
	fullName: string | null;
	email: string | null;
	phone: string | null;
	tags: string[];
	firstSeenAt: string;
	lastSeenAt: string;
	createdAt: string;
	metadata?: Record<string, unknown> | null;
}

export type TimelineEventType =
	| "conversation_started"
	| "message"
	| "note"
	| "tag_added"
	| "conversation_resolved"
	| "conversation_closed";

export interface ContactTimelineEvent {
	id: string;
	type: TimelineEventType;
	occurred_at: string;
	conversation_id: string;
	channel: string;
	payload: Record<string, unknown>;
}

function mapContact(raw: Record<string, unknown>): Contact {
	return {
		id: String(raw.id),
		workspaceId: String(raw.workspaceId ?? raw.workspace_id),
		fullName:
			raw.fullName != null
				? String(raw.fullName)
				: raw.full_name != null
					? String(raw.full_name)
					: null,
		email: raw.email != null ? String(raw.email) : null,
		phone: raw.phone != null ? String(raw.phone) : null,
		tags: Array.isArray(raw.tags)
			? raw.tags.filter((t): t is string => typeof t === "string")
			: [],
		firstSeenAt: String(raw.firstSeenAt ?? raw.first_seen_at),
		lastSeenAt: String(raw.lastSeenAt ?? raw.last_seen_at),
		createdAt: String(raw.createdAt ?? raw.created_at),
		metadata:
			raw.metadata != null && typeof raw.metadata === "object"
				? (raw.metadata as Record<string, unknown>)
				: null,
	};
}

export async function fetchContacts(
	workspaceId: string,
	q?: string,
): Promise<Contact[]> {
	const params = new URLSearchParams();
	if (q) params.set("q", q);
	const res = await authFetch(
		`${API_URL}/v1/contacts${params.toString() ? `?${params}` : ""}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: Record<string, unknown>[] };
	return (json.data ?? []).map(mapContact);
}

export async function fetchContact(
	workspaceId: string,
	contactId: string,
): Promise<Contact | null> {
	const res = await authFetch(`${API_URL}/v1/contacts/${contactId}`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return null;
	const json = (await res.json()) as {
		data?: Record<string, unknown>;
	} & Record<string, unknown>;
	const raw = json.data ?? json;
	return mapContact(raw as Record<string, unknown>);
}

export async function fetchContactTimeline(
	workspaceId: string,
	contactId: string,
	opts?: {
		channel?: string;
		from?: string;
		to?: string;
		limit?: number;
		cursor?: string;
	},
): Promise<{ events: ContactTimelineEvent[]; next_cursor: string | null }> {
	const params = new URLSearchParams();
	if (opts?.channel) params.set("channel", opts.channel);
	if (opts?.from) params.set("from", opts.from);
	if (opts?.to) params.set("to", opts.to);
	if (opts?.limit) params.set("limit", String(opts.limit));
	if (opts?.cursor) params.set("cursor", opts.cursor);
	const qs = params.toString();
	const res = await authFetch(
		`${API_URL}/v1/contacts/${contactId}/timeline${qs ? `?${qs}` : ""}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return { events: [], next_cursor: null };
	const json = (await res.json()) as {
		data?: { events?: ContactTimelineEvent[]; next_cursor?: string | null };
	};
	return {
		events: json.data?.events ?? [],
		next_cursor: json.data?.next_cursor ?? null,
	};
}

export type ContactBulkAction =
	| { action: "add_tags"; contact_ids: string[]; tags: string[] }
	| { action: "remove_tags"; contact_ids: string[]; tags: string[] }
	| { action: "ban"; contact_ids: string[]; reason?: string }
	| { action: "unban"; contact_ids: string[] }
	| { action: "merge"; primary_id: string; merge_ids: string[] };

export interface ContactBulkResult {
	processed: number;
	failed: number;
	errors?: string[];
}

export interface ContactImportResult {
	created: number;
	skipped: number;
	errors: string[];
}

export async function contactBulkAction(
	workspaceId: string,
	payload: ContactBulkAction,
): Promise<ContactBulkResult | null> {
	const res = await authFetch(`${API_URL}/v1/contacts/bulk`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: ContactBulkResult };
	return json.data ?? null;
}

export async function exportContactsCsv(
	workspaceId: string,
	contactIds?: string[],
): Promise<Blob | null> {
	const res = await authFetch(`${API_URL}/v1/contacts/export`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(
			contactIds?.length ? { contact_ids: contactIds } : {},
		),
	});
	if (!res.ok) return null;
	return res.blob();
}

export async function importContactsRows(
	workspaceId: string,
	rows: Array<{
		full_name?: string | null;
		email?: string | null;
		phone?: string | null;
		tags?: string[];
		external_id?: string | null;
	}>,
): Promise<ContactImportResult | null> {
	const res = await authFetch(`${API_URL}/v1/contacts/import`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({ rows }),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: ContactImportResult };
	return json.data ?? null;
}

export interface NotificationPreferences {
	push_enabled: boolean;
	new_conversation: boolean;
	new_message: boolean;
	email_enabled: boolean;
	email_new_conversation: boolean;
	email_assigned: boolean;
	email_mention: boolean;
	sound_enabled: boolean;
	sound_id: string;
	sound_when_hidden: boolean;
	browser_enabled: boolean;
	browser_new_conversation: boolean;
	browser_new_message: boolean;
	browser_needs_human: boolean;
}

export async function fetchNotificationPreferences(
	workspaceId: string,
): Promise<NotificationPreferences | null> {
	const res = await authFetch(`${API_URL}/v1/notification-preferences`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: NotificationPreferences };
	return json.data ?? null;
}

export async function updateNotificationPreferences(
	workspaceId: string,
	patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences | null> {
	const res = await authFetch(`${API_URL}/v1/notification-preferences`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(patch),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: NotificationPreferences };
	return json.data ?? null;
}

export async function savePushSubscription(
	workspaceId: string,
	sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/push/subscribe`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(sub),
	});
	return res.ok;
}

export async function removePushSubscription(
	workspaceId: string,
	endpoint: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/push/subscribe`, {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify({ endpoint }),
	});
	return res.ok;
}

export function isContactBannedMeta(metadata: unknown): boolean {
	if (!metadata || typeof metadata !== "object") return false;
	return typeof (metadata as { bannedAt?: string }).bannedAt === "string";
}

export async function fetchContactSegments(
	workspaceId: string,
): Promise<ContactSegment[]> {
	const res = await authFetch(`${API_URL}/v1/contact-segments`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: Record<string, unknown>[] };
	return (json.data ?? []).map(mapContactSegment);
}

export async function createContactSegment(
	workspaceId: string,
	payload: {
		name: string;
		description?: string;
		filters?: SegmentFilters;
		is_dynamic?: boolean;
	},
): Promise<ContactSegment | null> {
	const res = await authFetch(`${API_URL}/v1/contact-segments`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: Record<string, unknown> };
	return json.data ? mapContactSegment(json.data) : null;
}

export async function updateContactSegment(
	workspaceId: string,
	segmentId: string,
	payload: Partial<{
		name: string;
		description: string;
		filters: SegmentFilters;
		is_dynamic: boolean;
	}>,
): Promise<ContactSegment | null> {
	const res = await authFetch(`${API_URL}/v1/contact-segments/${segmentId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: Record<string, unknown> };
	return json.data ? mapContactSegment(json.data) : null;
}

export async function deleteContactSegment(
	workspaceId: string,
	segmentId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/contact-segments/${segmentId}`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function previewContactSegment(
	workspaceId: string,
	segmentId: string,
	filters?: SegmentFilters,
): Promise<SegmentPreview | null> {
	const res = await authFetch(
		filters
			? `${API_URL}/v1/contact-segments/${segmentId}/preview`
			: `${API_URL}/v1/contact-segments/${segmentId}/preview`,
		{
			method: filters ? "POST" : "GET",
			headers: {
				...(filters
					? { "Content-Type": "application/json", ...authHeaders(workspaceId) }
					: authHeaders(workspaceId)),
			},
			body: filters ? JSON.stringify({ filters }) : undefined,
		},
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: SegmentPreview };
	return json.data ?? null;
}

export interface CsatSummary {
	enabled: boolean;
	total_responses: number;
	average_score: number | null;
	by_agent: Array<{
		agent_id: string | null;
		agent_name: string | null;
		count: number;
		average_score: number;
	}>;
	distribution: Record<string, number>;
}

export async function fetchCsatSummary(
	workspaceId: string,
	from: string,
	to: string,
): Promise<CsatSummary | null> {
	const params = new URLSearchParams({ from, to });
	const res = await authFetch(
		`${API_URL}/v1/reports/csat-summary?${params}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: CsatSummary };
	return json.data ?? null;
}

export interface AgentPerformanceRow {
	agent_id: string;
	agent_name: string | null;
	agent_email: string | null;
	conversations_total: number;
	conversations_resolved: number;
	resolution_rate: number | null;
	avg_first_response_sec: number | null;
	csat_average: number | null;
	csat_count: number;
}

export interface AgentPerformanceReport {
	agents: AgentPerformanceRow[];
	team: {
		conversations_total: number;
		conversations_resolved: number;
		resolution_rate: number | null;
		avg_first_response_sec: number | null;
		csat_average: number | null;
		csat_count: number;
	};
	refreshed_at: string | null;
}

export async function fetchAgentPerformanceReport(
	workspaceId: string,
	from: string,
	to: string,
): Promise<AgentPerformanceReport | null> {
	const params = new URLSearchParams({ from, to });
	const res = await authFetch(
		`${API_URL}/v1/reports/agents?${params}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: AgentPerformanceReport };
	return json.data ?? null;
}

export interface ReportsOverview {
	conversations_over_time: Array<{
		day: string;
		created: number;
		resolved: number;
	}>;
	peak_hours: Array<{
		dow: number;
		hour: number;
		count: number;
	}>;
	channels: Array<{
		channel: string;
		count: number;
	}>;
	top_tags: Array<{
		tag: string;
		count: number;
	}>;
	funnel: {
		started: number;
		agent_replied: number;
		resolved: number;
		closed: number;
	};
}

export async function fetchReportsOverview(
	workspaceId: string,
	from: string,
	to: string,
): Promise<ReportsOverview | null> {
	const params = new URLSearchParams({ from, to });
	const res = await authFetch(
		`${API_URL}/v1/reports/overview?${params}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: ReportsOverview };
	return json.data ?? null;
}

export async function downloadReportsOverviewCsv(
	workspaceId: string,
	from: string,
	to: string,
): Promise<{ ok: boolean; error?: string }> {
	const params = new URLSearchParams({ from, to, format: "csv" });
	const res = await authFetch(
		`${API_URL}/v1/reports/overview/export?${params}`,
		{ headers: authHeaders(workspaceId) },
	);
	if (!res.ok) {
		return { ok: false, error: `HTTP ${res.status}` };
	}
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `chatbox-overview-${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
	return { ok: true };
}

export async function downloadAgentPerformanceCsv(
	workspaceId: string,
	from: string,
	to: string,
): Promise<{ ok: boolean; error?: string }> {
	const params = new URLSearchParams({ from, to, format: "csv" });
	const res = await authFetch(
		`${API_URL}/v1/reports/agents/export?${params}`,
		{ headers: authHeaders(workspaceId) },
	);
	if (!res.ok) {
		return { ok: false, error: `HTTP ${res.status}` };
	}
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `chatbox-agents-${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
	return { ok: true };
}

export async function fetchSlaPolicy(
	workspaceId: string,
): Promise<SlaPolicy | null> {
	const res = await authFetch(`${API_URL}/v1/sla-policy`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: SlaPolicy };
	return json.data ?? null;
}

export async function updateSlaPolicy(
	workspaceId: string,
	policy: Partial<SlaPolicy>,
): Promise<{ ok: boolean; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/sla-policy`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(policy),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "ذخیره SLA ناموفق بود." };
	}
	return { ok: true };
}

export async function fetchSlaViolations(
	workspaceId: string,
	from: string,
	to: string,
): Promise<SlaViolationRow[]> {
	const params = new URLSearchParams({ from, to });
	const res = await authFetch(
		`${API_URL}/v1/reports/sla-violations?${params}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: SlaViolationRow[] };
	return json.data ?? [];
}

export type WebhookEventType =
	| "conversation.created"
	| "message.created"
	| "conversation.resolved";

export interface WebhookEndpoint {
	id: string;
	workspaceId: string;
	name: string;
	url: string;
	secret_preview: string;
	enabled: boolean;
	events: WebhookEventType[];
	createdAt: string;
	updatedAt: string;
}

export interface WebhookDelivery {
	id: string;
	endpointId: string;
	workspaceId: string;
	event: string;
	payload: Record<string, unknown>;
	status: string;
	httpStatus: number | null;
	responseBody: string | null;
	error: string | null;
	attempts: number;
	createdAt: string;
	deliveredAt: string | null;
}

export async function fetchWebhookEndpoints(
	workspaceId: string,
): Promise<WebhookEndpoint[]> {
	const res = await authFetch(`${API_URL}/v1/webhook-endpoints`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: WebhookEndpoint[] };
	return json.data ?? [];
}

export async function createWebhookEndpoint(
	workspaceId: string,
	payload: {
		name: string;
		url: string;
		events?: WebhookEventType[];
		enabled?: boolean;
	},
): Promise<{ data?: WebhookEndpoint & { secret?: string }; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/webhook-endpoints`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { error: json.error?.message ?? "ایجاد webhook ناموفق بود." };
	}
	const json = (await res.json()) as {
		data?: WebhookEndpoint & { secret?: string };
	};
	return { data: json.data };
}

export async function updateWebhookEndpoint(
	workspaceId: string,
	endpointId: string,
	payload: Partial<{
		name: string;
		url: string;
		events: WebhookEventType[];
		enabled: boolean;
	}>,
): Promise<{ ok: boolean; data?: WebhookEndpoint; error?: string }> {
	const res = await authFetch(`${API_URL}/v1/webhook-endpoints/${endpointId}`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(workspaceId),
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { ok: false, error: json.error?.message ?? "ذخیره webhook ناموفق بود." };
	}
	const json = (await res.json()) as { data?: WebhookEndpoint };
	return { ok: true, data: json.data };
}

export async function deleteWebhookEndpoint(
	workspaceId: string,
	endpointId: string,
): Promise<boolean> {
	const res = await authFetch(`${API_URL}/v1/webhook-endpoints/${endpointId}`, {
		method: "DELETE",
		headers: authHeaders(workspaceId),
	});
	return res.ok;
}

export async function rotateWebhookSecret(
	workspaceId: string,
	endpointId: string,
): Promise<{ secret?: string; error?: string }> {
	const res = await authFetch(
		`${API_URL}/v1/webhook-endpoints/${endpointId}/rotate-secret`,
		{
			method: "POST",
			headers: authHeaders(workspaceId),
		},
	);
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as {
			error?: { message?: string };
		};
		return { error: json.error?.message ?? "چرخش secret ناموفق بود." };
	}
	const json = (await res.json()) as { data?: { secret?: string } };
	return { secret: json.data?.secret };
}

export async function fetchWebhookDeliveries(
	workspaceId: string,
	endpointId: string,
	limit = 30,
): Promise<WebhookDelivery[]> {
	const params = new URLSearchParams({ limit: String(limit) });
	const res = await authFetch(
		`${API_URL}/v1/webhook-endpoints/${endpointId}/deliveries?${params}`,
		{ headers: authHeaders(workspaceId), cache: "no-store" },
	);
	if (!res.ok) return [];
	const json = (await res.json()) as { data?: WebhookDelivery[] };
	return json.data ?? [];
}

export interface AuditLogRow {
	id: string;
	workspace_id: string | null;
	actor_user_id: string | null;
	actor_email: string | null;
	actor_name: string | null;
	action: string;
	target_type: string | null;
	target_id: string | null;
	diff: Record<string, unknown> | null;
	ip_address: string | null;
	user_agent: string | null;
	created_at: string;
}

export async function fetchAuditLogs(
	workspaceId: string,
	params: {
		from?: string;
		to?: string;
		action?: string;
		limit?: number;
		offset?: number;
	},
): Promise<{ rows: AuditLogRow[]; total: number }> {
	const q = new URLSearchParams();
	if (params.from) q.set("from", params.from);
	if (params.to) q.set("to", params.to);
	if (params.action) q.set("action", params.action);
	if (params.limit != null) q.set("limit", String(params.limit));
	if (params.offset != null) q.set("offset", String(params.offset));
	const res = await authFetch(`${API_URL}/v1/audit-logs?${q}`, {
		headers: authHeaders(workspaceId),
		cache: "no-store",
	});
	if (!res.ok) return { rows: [], total: 0 };
	const json = (await res.json()) as {
		data?: AuditLogRow[];
		meta?: { total?: number };
	};
	return { rows: json.data ?? [], total: json.meta?.total ?? 0 };
}

export async function downloadAuditLogsCsv(
	workspaceId: string,
	from: string,
	to: string,
	action?: string,
): Promise<boolean> {
	const q = new URLSearchParams({ format: "csv", from, to });
	if (action) q.set("action", action);
	const res = await authFetch(`${API_URL}/v1/audit-logs/export?${q}`, {
		headers: authHeaders(workspaceId),
	});
	if (!res.ok) return false;
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `chatbox-audit-${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
	return true;
}

export { API_URL };
