/** Billing plan catalog (prices in Rial). */

export type BillablePlan = "starter" | "pro" | "enterprise";

export interface PlanDefinition {
	name: BillablePlan;
	priceRial: number;
	workspacePlan: BillablePlan;
	trialDays: number;
	contactSales?: boolean;
}

export const BILLING_PLANS: Record<BillablePlan, PlanDefinition> = {
	starter: {
		name: "starter",
		priceRial: Number(process.env.PLAN_STARTER_RIAL ?? 990_000),
		workspacePlan: "starter",
		trialDays: 0,
	},
	pro: {
		name: "pro",
		priceRial: Number(process.env.PLAN_PRO_RIAL ?? 2_490_000),
		workspacePlan: "pro",
		trialDays: Number(process.env.PLAN_PRO_TRIAL_DAYS ?? 7),
	},
	enterprise: {
		name: "enterprise",
		priceRial: Number(process.env.PLAN_ENTERPRISE_RIAL ?? 9_900_000),
		workspacePlan: "enterprise",
		trialDays: 0,
		contactSales: true,
	},
};

export function isBillablePlan(plan: string): plan is BillablePlan {
	return plan in BILLING_PLANS;
}

export function formatPriceToman(priceRial: number): string {
	return `${(priceRial / 10).toLocaleString("fa-IR")} تومان`;
}

export function plansForApi() {
	return Object.values(BILLING_PLANS).map((p) => ({
		name: p.name,
		price_rial: p.priceRial,
		price_display: formatPriceToman(p.priceRial),
		trial_days: p.trialDays,
		contact_sales: p.contactSales ?? false,
	}));
}
