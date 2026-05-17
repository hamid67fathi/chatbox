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
	contact?: {
		id: string;
		fullName: string;
		email: string | null;
		metadata?: Record<string, unknown> | null;
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

export interface ConversationDetail extends Conversation {
	priority: number;
	assignedAgentId: string | null;
	tags: string[];
	notes: ConversationNote[];
	visitor?: VisitorInfo | null;
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
		summary:
			(typeof raw.metadata === "object" &&
				raw.metadata &&
				(raw.metadata as { summary?: string }).summary) ||
			null,
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
	data: Partial<WidgetConfigPublic>,
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

export { API_URL };
