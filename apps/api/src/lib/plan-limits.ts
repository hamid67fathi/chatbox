import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations, workspaceMembers, workspaces } from "../db/schema/index.js";
import { getAiBudgetStatus, type AiBudgetStatus } from "./ai-budget.js";
import { planLimitExceeded } from "./errors.js";
import { getIO } from "../ws/broadcast.js";

export type LimitLevel = "ok" | "warning" | "exhausted" | "unlimited";

export interface UsageMetric {
	key: string;
	label: string;
	used: number;
	limit: number | null;
	remaining: number | null;
	percentUsed: number | null;
	level: LimitLevel;
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

const WARNING_PCT = Number(process.env.PLAN_LIMIT_WARN_PCT ?? 80);

const PLAN_MAX_MEMBERS: Record<string, number | null> = {
	free: Number(process.env.PLAN_MAX_MEMBERS_FREE ?? 1),
	starter: Number(process.env.PLAN_MAX_MEMBERS_STARTER ?? 3),
	pro: Number(process.env.PLAN_MAX_MEMBERS_PRO ?? 10),
	enterprise: null,
};

const PLAN_MAX_CONVERSATIONS_MONTH: Record<string, number | null> = {
	free: Number(process.env.PLAN_MAX_CONVERSATIONS_FREE ?? 100),
	starter: Number(process.env.PLAN_MAX_CONVERSATIONS_STARTER ?? 1_000),
	pro: Number(process.env.PLAN_MAX_CONVERSATIONS_PRO ?? 10_000),
	enterprise: null,
};

/** Monthly upload quota in bytes. */
const PLAN_MAX_UPLOAD_BYTES_MONTH: Record<string, number | null> = {
	free: Number(process.env.PLAN_MAX_UPLOAD_MB_FREE ?? 50) * 1024 * 1024,
	starter: Number(process.env.PLAN_MAX_UPLOAD_MB_STARTER ?? 500) * 1024 * 1024,
	pro: Number(process.env.PLAN_MAX_UPLOAD_MB_PRO ?? 2_048) * 1024 * 1024,
	enterprise: null,
};

function monthStartUtc(d = new Date()): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthKey(d = new Date()): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function planValue<T>(plan: string, table: Record<string, T>, fallback: T): T {
	if (plan in table) return table[plan]!;
	return fallback;
}

export function computeLimitLevel(used: number, limit: number | null): LimitLevel {
	if (limit == null) return "unlimited";
	if (limit <= 0) return used > 0 ? "exhausted" : "ok";
	const pct = (used / limit) * 100;
	if (pct >= 100) return "exhausted";
	if (pct >= WARNING_PCT) return "warning";
	return "ok";
}

function buildMetric(
	key: string,
	label: string,
	used: number,
	limit: number | null,
	unit: UsageMetric["unit"],
): UsageMetric {
	const remaining =
		limit == null ? null : Math.max(0, limit - used);
	const percentUsed =
		limit == null || limit <= 0
			? null
			: Math.min(100, Math.round((used / limit) * 1000) / 10);
	return {
		key,
		label,
		used,
		limit,
		remaining,
		percentUsed,
		level: computeLimitLevel(used, limit),
		unit,
	};
}

type UploadUsageSettings = {
	planUsage?: {
		uploadMonth?: string;
		uploadBytes?: number;
		warningMonth?: string;
		exhaustedMonth?: string;
	};
};

export async function countWorkspaceMembers(workspaceId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(workspaceMembers)
		.where(eq(workspaceMembers.workspaceId, workspaceId));
	return Number(row?.n ?? 0);
}

export async function countMonthlyConversations(workspaceId: string): Promise<number> {
	const since = monthStartUtc();
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(conversations)
		.where(
			and(
				eq(conversations.workspaceId, workspaceId),
				gte(conversations.createdAt, since),
			),
		);
	return Number(row?.n ?? 0);
}

async function readUploadBytesMonth(workspaceId: string): Promise<number> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const settings = (ws?.settings ?? {}) as UploadUsageSettings;
	const usage = settings.planUsage ?? {};
	const key = monthKey();
	if (usage.uploadMonth !== key) return 0;
	return Math.max(0, usage.uploadBytes ?? 0);
}

export async function recordUploadBytes(
	workspaceId: string,
	bytes: number,
): Promise<void> {
	if (bytes <= 0) return;
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const settings = (ws?.settings ?? {}) as UploadUsageSettings;
	const usage = settings.planUsage ?? {};
	const key = monthKey();
	const prevBytes = usage.uploadMonth === key ? (usage.uploadBytes ?? 0) : 0;

	await db
		.update(workspaces)
		.set({
			settings: {
				...settings,
				planUsage: {
					...usage,
					uploadMonth: key,
					uploadBytes: prevBytes + bytes,
				},
			},
			updatedAt: new Date(),
		})
		.where(eq(workspaces.id, workspaceId));
}

export async function getPlanUsageStatus(
	workspaceId: string,
): Promise<PlanUsageStatus | null> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { id: true, plan: true },
	});
	if (!ws) return null;

	const [memberCount, convCount, uploadBytes, ai] = await Promise.all([
		countWorkspaceMembers(workspaceId),
		countMonthlyConversations(workspaceId),
		readUploadBytesMonth(workspaceId),
		getAiBudgetStatus(workspaceId),
	]);

	const memberLimit = planValue(ws.plan, PLAN_MAX_MEMBERS, 1);
	const convLimit = planValue(ws.plan, PLAN_MAX_CONVERSATIONS_MONTH, 100);
	const uploadLimit = planValue(ws.plan, PLAN_MAX_UPLOAD_BYTES_MONTH, 50 * 1024 * 1024);

	const members = buildMetric(
		"members",
		"اپراتور / عضو",
		memberCount,
		memberLimit,
		"count",
	);
	const conversationsMonth = buildMetric(
		"conversations_month",
		"مکالمه این ماه",
		convCount,
		convLimit,
		"count",
	);
	const uploadBytesMonth = buildMetric(
		"upload_bytes_month",
		"آپلود این ماه",
		uploadBytes,
		uploadLimit,
		"bytes",
	);

	return {
		plan: ws.plan,
		periodStart: monthStartUtc().toISOString(),
		members,
		conversationsMonth,
		uploadBytesMonth,
		ai,
		allowInviteMember: members.level !== "exhausted",
		allowNewConversation: conversationsMonth.level !== "exhausted",
		allowUpload: uploadBytesMonth.level !== "exhausted",
	};
}

function throwIfExhausted(
	metric: UsageMetric,
	plan: string,
	message: string,
): void {
	if (metric.level !== "exhausted") return;
	throw planLimitExceeded({
		metric: metric.key,
		used: metric.used,
		limit: metric.limit,
		plan,
		message,
	});
}

export async function assertCanInviteMember(workspaceId: string): Promise<void> {
	const status = await getPlanUsageStatus(workspaceId);
	if (!status) return;
	throwIfExhausted(
		status.members,
		status.plan,
		`سقف تعداد اعضای workspace (${status.members.limit}) پر شده است. پلن را ارتقا دهید.`,
	);
}

export async function assertCanCreateConversation(workspaceId: string): Promise<void> {
	const status = await getPlanUsageStatus(workspaceId);
	if (!status) return;
	throwIfExhausted(
		status.conversationsMonth,
		status.plan,
		`سقف مکالمه ماهانه (${status.conversationsMonth.limit}) پر شده است. پلن را ارتقا دهید.`,
	);
}

export async function assertCanUpload(
	workspaceId: string,
	fileBytes: number,
): Promise<void> {
	const status = await getPlanUsageStatus(workspaceId);
	if (!status) return;

	const limit = status.uploadBytesMonth.limit;
	if (limit == null) return;

	const projected = status.uploadBytesMonth.used + fileBytes;
	if (projected > limit) {
		throw planLimitExceeded({
			metric: "upload_bytes_month",
			used: status.uploadBytesMonth.used,
			limit,
			plan: status.plan,
			additional_bytes: fileBytes,
			message: `سقف آپلود ماهانه پر شده است (${Math.round(limit / (1024 * 1024))} مگابایت).`,
		});
	}
}

/** Emit socket alert once per month when a non-AI metric hits warning/exhausted. */
export async function notifyPlanUsageIfNeeded(workspaceId: string): Promise<void> {
	const status = await getPlanUsageStatus(workspaceId);
	if (!status) return;

	const alerts = [
		status.members,
		status.conversationsMonth,
		status.uploadBytesMonth,
	].filter((m) => m.level === "warning" || m.level === "exhausted");
	if (alerts.length === 0) return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const settings = (ws?.settings ?? {}) as UploadUsageSettings;
	const usage = settings.planUsage ?? {};
	const key = monthKey();
	const worst = alerts.some((a) => a.level === "exhausted")
		? "exhausted"
		: "warning";
	const flagKey =
		worst === "exhausted" ? "exhaustedMonth" : "warningMonth";
	if (usage[flagKey] === key) return;

	await db
		.update(workspaces)
		.set({
			settings: {
				...settings,
				planUsage: { ...usage, [flagKey]: key },
			},
			updatedAt: new Date(),
		})
		.where(eq(workspaces.id, workspaceId));

	try {
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("workspace:plan_usage", {
			level: worst,
			plan: status.plan,
			members: status.members,
			conversations_month: status.conversationsMonth,
			upload_bytes_month: status.uploadBytesMonth,
		});
	} catch {
		/* socket not ready */
	}
}
