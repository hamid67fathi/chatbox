"use client";

import { Button } from "@/components/ui/button";
import {
	type AiBudgetStatus,
	type BillingPlan,
	fetchAiUsage,
	fetchBillingPlans,
	fetchSubscription,
	startBillingCheckout,
} from "@/lib/api";
import { CreditCard, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

export function BillingPanel({ workspaceId, workspaceRole }: Props) {
	const [plans, setPlans] = useState<BillingPlan[]>([]);
	const [usage, setUsage] = useState<AiBudgetStatus | null>(null);
	const [subscription, setSubscription] = useState<{
		plan: string;
		status: string;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const canPurchase = workspaceRole === "owner" || workspaceRole === "admin";

	const load = useCallback(async () => {
		setLoading(true);
		const [p, u, s] = await Promise.all([
			fetchBillingPlans(workspaceId),
			fetchAiUsage(workspaceId),
			fetchSubscription(workspaceId),
		]);
		setPlans(p);
		setUsage(u);
		setSubscription(
			s ? { plan: s.plan, status: s.status } : null,
		);
		setLoading(false);
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	async function handleCheckout(planName: string) {
		setCheckoutPlan(planName);
		setError(null);
		const result = await startBillingCheckout(workspaceId, planName);
		setCheckoutPlan(null);
		if (result.error) {
			setError(result.error);
			return;
		}
		if (result.redirect_url) {
			window.location.href = result.redirect_url;
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center p-12 text-muted-foreground">
				<Loader2 className="h-6 w-6 animate-spin" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-8 p-6">
			<div>
				<h1 className="flex items-center gap-2 text-2xl font-bold">
					<CreditCard className="h-7 w-7" />
					اشتراک و اعتبار
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					پلن فعلی، مصرف AI و ارتقای اشتراک (درگاه sandbox زرین‌پال)
				</p>
			</div>

			{error && (
				<p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</p>
			)}

			<section className="rounded-xl border border-border bg-card p-6">
				<h2 className="font-semibold">وضعیت فعلی</h2>
				<dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground">پلن workspace</dt>
						<dd className="font-medium">{usage?.plan ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">اشتراک</dt>
						<dd className="font-medium">
							{subscription
								? `${subscription.plan} (${subscription.status})`
								: "بدون اشتراک فعال"}
						</dd>
					</div>
					{usage && usage.totalLimit != null && (
						<>
							<div>
								<dt className="text-muted-foreground">اعتبار AI مصرف‌شده</dt>
								<dd className="font-medium">
									{usage.usedCredits} / {usage.totalLimit}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">باقی‌مانده</dt>
								<dd className="font-medium">
									{usage.remainingCredits ?? "—"} اعتبار
								</dd>
							</div>
						</>
					)}
					{usage?.level === "unlimited" && (
						<div className="sm:col-span-2 text-emerald-600">
							پلن enterprise — اعتبار AI نامحدود
						</div>
					)}
				</dl>
			</section>

			<section>
				<h2 className="mb-4 font-semibold">پلن‌های قابل خرید</h2>
				<div className="grid gap-4 sm:grid-cols-3">
					{plans.map((plan) => (
						<article
							key={plan.name}
							className="flex flex-col rounded-xl border border-border bg-card p-5"
						>
							<h3 className="font-bold capitalize">{plan.name}</h3>
							<p className="mt-2 text-xl text-primary">{plan.price_display}</p>
							{canPurchase ? (
								<Button
									className="mt-6 w-full"
									disabled={checkoutPlan === plan.name}
									onClick={() => void handleCheckout(plan.name)}
								>
									{checkoutPlan === plan.name ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"پرداخت (sandbox)"
									)}
								</Button>
							) : (
								<p className="mt-6 text-xs text-muted-foreground">
									فقط owner/admin می‌توانند خرید کنند.
								</p>
							)}
						</article>
					))}
				</div>
			</section>
		</div>
	);
}
