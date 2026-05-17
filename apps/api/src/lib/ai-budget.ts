import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { aiInteractions, workspaces } from "../db/schema/index.js";
import { aiBudgetExhausted } from "./errors.js";
import { getIO } from "../ws/broadcast.js";

export type AiBudgetLevel = "ok" | "warning" | "exhausted" | "unlimited";

export interface AiBudgetStatus {
	plan: string;
	monthlyLimit: number | null;
	bonusCredits: number;
	totalLimit: number | null;
	usedCredits: number;
	remainingCredits: number | null;
	percentUsed: number | null;
	level: AiBudgetLevel;
	periodStart: string;
	allowAi: boolean;
}

const PLAN_MONTHLY_CREDITS: Record<string, number | null> = {
	free: Number(process.env.AI_CREDITS_FREE ?? 500),
	starter: Number(process.env.AI_CREDITS_STARTER ?? 5_000),
	pro: Number(process.env.AI_CREDITS_PRO ?? 25_000),
	enterprise: null,
};

const WARNING_PCT = Number(process.env.AI_BUDGET_WARN_PCT ?? 80);

function monthStartUtc(d = new Date()): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthKey(d = new Date()): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function tokensToCredits(inputTokens = 0, outputTokens = 0): number {
	const total = Math.max(0, inputTokens) + Math.max(0, outputTokens);
	if (total === 0) return 0;
	return Math.max(1, Math.ceil(total / 1000));
}

/** Rough USD estimate for logging (rates per 1M tokens). */
export function estimateCostUsd(
	model: string,
	inputTokens: number,
	outputTokens: number,
): string {
	const m = model.toLowerCase();
	let inRate = 0.15;
	let outRate = 0.6;
	if (m.includes("claude") || m.includes("anthropic")) {
		inRate = 0.25;
		outRate = 1.25;
	} else if (m.includes("embedding")) {
		inRate = 0.02;
		outRate = 0;
	}
	const cost =
		(inputTokens * inRate + outputTokens * outRate) / 1_000_000;
	return cost.toFixed(6);
}

function planLimit(plan: string): number | null {
	if (plan in PLAN_MONTHLY_CREDITS) return PLAN_MONTHLY_CREDITS[plan]!;
	return PLAN_MONTHLY_CREDITS.free ?? 500;
}

export async function getMonthlyUsedCredits(workspaceId: string): Promise<number> {
	const since = monthStartUtc();
	const [row] = await db
		.select({
			credits: sql<number>`coalesce(sum(
				case
					when coalesce(${aiInteractions.inputTokens}, 0) + coalesce(${aiInteractions.outputTokens}, 0) = 0 then 0
					else greatest(1, ceil(
						(coalesce(${aiInteractions.inputTokens}, 0) + coalesce(${aiInteractions.outputTokens}, 0))::numeric / 1000
					))
				end
			), 0)`,
		})
		.from(aiInteractions)
		.where(
			and(
				eq(aiInteractions.workspaceId, workspaceId),
				gte(aiInteractions.createdAt, since),
			),
		);
	return Number(row?.credits ?? 0);
}

export async function getAiBudgetStatus(
	workspaceId: string,
): Promise<AiBudgetStatus | null> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { id: true, plan: true, aiCredits: true, settings: true },
	});
	if (!ws) return null;

	const monthly = planLimit(ws.plan);
	const bonus = Math.max(0, ws.aiCredits ?? 0);
	const used = await getMonthlyUsedCredits(workspaceId);

	if (monthly == null) {
		return {
			plan: ws.plan,
			monthlyLimit: null,
			bonusCredits: bonus,
			totalLimit: null,
			usedCredits: used,
			remainingCredits: null,
			percentUsed: null,
			level: "unlimited",
			periodStart: monthStartUtc().toISOString(),
			allowAi: true,
		};
	}

	const total = monthly + bonus;
	const remaining = Math.max(0, total - used);
	const percentUsed = total > 0 ? Math.min(100, (used / total) * 100) : 0;

	let level: AiBudgetLevel = "ok";
	if (percentUsed >= 100) level = "exhausted";
	else if (percentUsed >= WARNING_PCT) level = "warning";

	return {
		plan: ws.plan,
		monthlyLimit: monthly,
		bonusCredits: bonus,
		totalLimit: total,
		usedCredits: used,
		remainingCredits: remaining,
		percentUsed: Math.round(percentUsed * 10) / 10,
		level,
		periodStart: monthStartUtc().toISOString(),
		allowAi: level !== "exhausted",
	};
}

export async function assertAiBudgetAllowed(workspaceId: string): Promise<void> {
	const status = await getAiBudgetStatus(workspaceId);
	if (!status) return;
	if (status.allowAi) return;

	throw aiBudgetExhausted({
		used_credits: status.usedCredits,
		total_limit: status.totalLimit,
		plan: status.plan,
	});
}

type BudgetSettings = {
	aiBudget?: {
		warningMonth?: string;
		exhaustedMonth?: string;
	};
};

async function maybeEmitBudgetAlerts(workspaceId: string, status: AiBudgetStatus) {
	if (status.level === "ok" || status.level === "unlimited") return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const settings = (ws?.settings ?? {}) as BudgetSettings;
	const aiBudget = settings.aiBudget ?? {};
	const key = monthKey();
	const patch: BudgetSettings["aiBudget"] = { ...aiBudget };

	let shouldEmit = false;
	if (status.level === "warning" && aiBudget.warningMonth !== key) {
		patch.warningMonth = key;
		shouldEmit = true;
	}
	if (status.level === "exhausted" && aiBudget.exhaustedMonth !== key) {
		patch.exhaustedMonth = key;
		shouldEmit = true;
	}

	if (shouldEmit) {
		await db
			.update(workspaces)
			.set({
				settings: { ...settings, aiBudget: patch },
				updatedAt: new Date(),
			})
			.where(eq(workspaces.id, workspaceId));
	}

	try {
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("workspace:ai_budget", {
			level: status.level,
			used_credits: status.usedCredits,
			total_limit: status.totalLimit,
			percent_used: status.percentUsed,
			remaining_credits: status.remainingCredits,
			plan: status.plan,
		});
	} catch {
		/* socket not ready */
	}
}

/** Call after persisting an ai_interactions row to emit threshold alerts. */
export async function notifyAiBudgetIfNeeded(workspaceId: string): Promise<void> {
	const status = await getAiBudgetStatus(workspaceId);
	if (!status || status.level === "ok" || status.level === "unlimited") return;
	await maybeEmitBudgetAlerts(workspaceId, status);
}
