"use client";

import { Button } from "@/components/ui/button";
import {
	type BillingPlan,
	type BillingStatus,
	type PaymentRow,
	type PlanUsageStatus,
	type UsageMetric,
	cancelSubscription,
	downloadInvoicePdf,
	fetchBillingPayments,
	fetchBillingPlans,
	fetchBillingStatus,
	fetchPlanUsage,
	startBillingCheckout,
	startProTrial,
} from "@/lib/api";
import { CreditCard, Download, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

export function BillingPanel({ workspaceId, workspaceRole }: Props) {
	const searchParams = useSearchParams();
	const paymentResult = searchParams.get("payment");
	const paymentRef = searchParams.get("ref");

	const [plans, setPlans] = useState<BillingPlan[]>([]);
	const [planUsage, setPlanUsage] = useState<PlanUsageStatus | null>(null);
	const [billing, setBilling] = useState<BillingStatus | null>(null);
	const [payments, setPayments] = useState<PaymentRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const canManage = workspaceRole === "owner" || workspaceRole === "admin";

	const load = useCallback(async () => {
		setLoading(true);
		const [p, u, b, pay] = await Promise.all([
			fetchBillingPlans(workspaceId),
			fetchPlanUsage(workspaceId),
			fetchBillingStatus(workspaceId),
			fetchBillingPayments(workspaceId),
		]);
		setPlans(p);
		setPlanUsage(u);
		setBilling(b);
		setPayments(pay);
		setLoading(false);
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (paymentResult === "success") {
			setSuccess(
				paymentRef
					? `پرداخت موفق — کد پیگیری: ${paymentRef}`
					: "پرداخت با موفقیت انجام شد.",
			);
			void load();
		} else if (paymentResult === "cancelled") {
			setError("پرداخت لغو شد.");
		} else if (paymentResult === "error") {
			setError("خطا در تأیید پرداخت.");
		}
	}, [paymentResult, paymentRef, load]);

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

	async function handleTrial() {
		setBusy("trial");
		setError(null);
		const result = await startProTrial(workspaceId);
		setBusy(null);
		if (result.error) {
			setError(result.error);
			return;
		}
		setSuccess("دوره آزمایشی ۷ روزه Pro فعال شد.");
		void load();
	}

	async function handleCancel() {
		setBusy("cancel");
		setError(null);
		const result = await cancelSubscription(workspaceId);
		setBusy(null);
		if (result.error) {
			setError(result.error);
			return;
		}
		setSuccess("اشتراک لغو شد.");
		void load();
	}

	if (loading) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-12 text-muted-foreground">
				<Loader2 className="h-6 w-6 animate-spin" />
			</div>
		);
	}

	const workspacePlan = billing?.workspace_plan ?? planUsage?.plan ?? "free";
	const trialEnds = billing?.trial_ends_at;
	const ai = planUsage?.ai;

	function usageRow(m: UsageMetric) {
		if (m.limit == null) return null;
		const pct = m.percentUsed ?? 0;
		const barColor =
			m.level === "exhausted"
				? "bg-destructive"
				: m.level === "warning"
					? "bg-amber-500"
					: "bg-primary";
		const display =
			m.unit === "bytes"
				? `${(m.used / (1024 * 1024)).toFixed(1)} / ${Math.round(m.limit / (1024 * 1024))} MB`
				: `${m.used} / ${m.limit}`;
		return (
			<div key={m.key} className="space-y-1">
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">{m.label}</span>
					<span className="font-medium">{display}</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-muted">
					<div
						className={`h-full transition-all ${barColor}`}
						style={{ width: `${Math.min(100, pct)}%` }}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<div className="mx-auto w-full max-w-4xl space-y-8 p-6 pb-10">
			<div>
				<h1 className="flex items-center gap-2 text-2xl font-bold">
					<CreditCard className="h-7 w-7" />
					اشتراک و اعتبار
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					پلن workspace، مصرف AI، پرداخت زرین‌پال و فاکتور PDF
				</p>
			</div>

			{success && (
				<p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
					{success}
				</p>
			)}
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
						<dd className="font-medium">{workspacePlan}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">اشتراک</dt>
						<dd className="font-medium">
							{billing?.subscription
								? `${billing.subscription.plan} (${billing.subscription.status})`
								: "—"}
						</dd>
					</div>
					{trialEnds && (
						<div className="sm:col-span-2">
							<dt className="text-muted-foreground">پایان دوره آزمایشی</dt>
							<dd className="font-medium">
								{new Date(trialEnds).toLocaleString("fa-IR")}
							</dd>
						</div>
					)}
					{ai && ai.totalLimit != null && (
						<>
							<div>
								<dt className="text-muted-foreground">اعتبار AI</dt>
								<dd className="font-medium">
									{ai.usedCredits} / {ai.totalLimit}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">باقی‌مانده AI</dt>
								<dd className="font-medium">
									{ai.remainingCredits ?? "—"}
								</dd>
							</div>
						</>
					)}
				</dl>

				{planUsage && (
					<div className="mt-6 space-y-4 border-t border-border pt-6">
						<h3 className="text-sm font-semibold">مصرف ماه جاری</h3>
						{usageRow(planUsage.members)}
						{usageRow(planUsage.conversationsMonth)}
						{usageRow(planUsage.uploadBytesMonth)}
						{ai && ai.totalLimit != null && usageRow({
							key: "ai_credits",
							label: "اعتبار AI",
							used: ai.usedCredits,
							limit: ai.totalLimit,
							remaining: ai.remainingCredits,
							percentUsed: ai.percentUsed,
							level: ai.level,
							unit: "credits",
						})}
					</div>
				)}

				{canManage && workspacePlan === "free" && (
					<Button
						className="mt-4"
						variant="outline"
						disabled={busy === "trial"}
						onClick={() => void handleTrial()}
					>
						{busy === "trial" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"۷ روز آزمایشی رایگان (Pro)"
						)}
					</Button>
				)}

				{canManage && billing?.subscription?.status === "active" && (
					<Button
						className="mt-4 ms-2"
						variant="ghost"
						disabled={busy === "cancel"}
						onClick={() => void handleCancel()}
					>
						لغو اشتراک
					</Button>
				)}
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
							{plan.trial_days ? (
								<p className="mt-1 text-xs text-muted-foreground">
									{plan.trial_days} روز آزمایشی
								</p>
							) : null}
							{canManage && !plan.contact_sales ? (
								<Button
									className="mt-6 w-full"
									disabled={checkoutPlan === plan.name}
									onClick={() => void handleCheckout(plan.name)}
								>
									{checkoutPlan === plan.name ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"پرداخت"
									)}
								</Button>
							) : plan.contact_sales ? (
								<p className="mt-6 text-xs text-muted-foreground">
									تماس با فروش
								</p>
							) : null}
						</article>
					))}
				</div>
			</section>

			{payments.length > 0 && (
				<section>
					<h2 className="mb-4 font-semibold">پرداخت‌های اخیر</h2>
					<ul className="divide-y rounded-xl border border-border bg-card">
						{payments.map((p) => (
							<li
								key={p.id}
								className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
							>
								<span>
									{(p.amount_rial / 10).toLocaleString("fa-IR")} تومان —{" "}
									<span className="text-muted-foreground">{p.status}</span>
								</span>
								{p.status === "paid" && p.invoice_url && (
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											void downloadInvoicePdf(workspaceId, p.id)
										}
									>
										<Download className="ms-1 h-3 w-3" />
										فاکتور PDF
									</Button>
								)}
							</li>
						))}
					</ul>
				</section>
			)}
			</div>
		</div>
	);
}
