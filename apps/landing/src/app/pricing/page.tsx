import { pricingPlans } from "@/lib/content";
import { signupUrl } from "@/lib/links";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "قیمت‌ها | چت‌باکس",
};

export default function PricingPage() {
	return (
		<div className="mx-auto max-w-6xl px-4 py-16">
			<h1 className="text-center text-3xl font-bold text-slate-900">
				پلنی متناسب با رشد کسب‌وکار شما
			</h1>
			<p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
				پرداخت ریالی از طریق زرین‌پال · بدون قرارداد بلندمدت · ۷ روز آزمایشی پلن
				حرفه‌ای
			</p>
			<div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				{pricingPlans.map((plan) => (
					<article
						key={plan.id}
						className={`flex flex-col rounded-2xl border p-6 ${
							plan.highlight
								? "border-brand bg-brand/5 shadow-lg ring-2 ring-brand"
								: "border-slate-200 bg-white"
						}`}
					>
						<h2 className="text-lg font-bold">{plan.name}</h2>
						<p className="mt-2 text-2xl font-semibold text-brand">{plan.price}</p>
						<ul className="mt-6 flex-1 space-y-2 text-sm text-slate-600">
							{plan.features.map((f) => (
								<li key={f}>✓ {f}</li>
							))}
						</ul>
						<Link
							href={signupUrl}
							className={`mt-8 block rounded-lg py-2.5 text-center text-sm font-medium ${
								plan.highlight
									? "bg-brand text-white hover:bg-brand-dark"
									: "border border-slate-200 hover:bg-slate-50"
							}`}
						>
							{plan.id === "enterprise" ? "تماس با فروش" : "شروع کنید"}
						</Link>
					</article>
				))}
			</div>
		</div>
	);
}
