import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { payments, subscriptions, workspaces } from "../db/schema/index.js";
import {
	BILLING_PLANS,
	type BillablePlan,
	isBillablePlan,
} from "./billing-plans.js";
import { ApiError, notFound } from "./errors.js";

const TRIAL_PLAN: BillablePlan = "pro";

export async function activatePaidSubscription(
	workspaceId: string,
	plan: BillablePlan,
	subscriptionId: string,
) {
	const def = BILLING_PLANS[plan];
	const now = new Date();
	const periodEnd = new Date(now);
	periodEnd.setMonth(periodEnd.getMonth() + 1);

	await db
		.update(workspaces)
		.set({
			plan: def.workspacePlan,
			trialEndsAt: null,
			updatedAt: now,
		})
		.where(eq(workspaces.id, workspaceId));

	await db
		.update(subscriptions)
		.set({
			plan,
			status: "active",
			periodStart: now,
			periodEnd,
			cancelledAt: null,
			updatedAt: now,
		})
		.where(eq(subscriptions.id, subscriptionId));
}

export async function startProTrial(workspaceId: string) {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
	});
	if (!ws) throw notFound("Workspace not found.");

	const settings = (ws.settings ?? {}) as Record<string, unknown>;
	if (settings.proTrialUsed) {
		throw new ApiError({
			code: "trial_used",
			message: "دوره آزمایشی ۷ روزه قبلاً استفاده شده است.",
			statusCode: 409,
		});
	}

	if (ws.trialEndsAt && ws.trialEndsAt > new Date()) {
		throw new ApiError({
			code: "trial_active",
			message: "دوره آزمایشی هنوز فعال است.",
			statusCode: 409,
		});
	}

	const days = BILLING_PLANS.pro.trialDays;
	const ends = new Date();
	ends.setDate(ends.getDate() + days);

	await db
		.update(workspaces)
		.set({
			plan: "pro",
			trialEndsAt: ends,
			settings: { ...settings, proTrialUsed: true },
			updatedAt: new Date(),
		})
		.where(eq(workspaces.id, workspaceId));

	const [sub] = await db
		.insert(subscriptions)
		.values({
			workspaceId,
			plan: TRIAL_PLAN,
			status: "trialing",
			periodStart: new Date(),
			periodEnd: ends,
		})
		.returning();

	return { subscription: sub, trial_ends_at: ends.toISOString() };
}

export async function cancelWorkspaceSubscription(workspaceId: string) {
	const sub = await db.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.workspaceId, workspaceId),
			eq(subscriptions.status, "active"),
		),
		orderBy: [desc(subscriptions.createdAt)],
	});

	if (!sub) {
		throw new ApiError({
			code: "no_subscription",
			message: "اشتراک فعالی برای لغو وجود ندارد.",
			statusCode: 404,
		});
	}

	const now = new Date();
	await db
		.update(subscriptions)
		.set({
			status: "cancelled",
			cancelledAt: now,
			updatedAt: now,
		})
		.where(eq(subscriptions.id, sub.id));

	return { ok: true, cancelled_at: now.toISOString() };
}

export async function getLastPaidPayment(workspaceId: string) {
	return db.query.payments.findFirst({
		where: and(
			eq(payments.workspaceId, workspaceId),
			eq(payments.status, "paid"),
		),
		orderBy: [desc(payments.paidAt)],
	});
}

export function assertBillablePlan(plan: string): BillablePlan {
	if (!isBillablePlan(plan)) {
		throw new ApiError({
			code: "validation_error",
			message: `Invalid plan. Choose: ${Object.keys(BILLING_PLANS).join(", ")}`,
			statusCode: 400,
			details: { field: "plan" },
		});
	}
	return plan;
}
