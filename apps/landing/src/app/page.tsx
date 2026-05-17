import { WidgetDemoSection } from "@/components/WidgetDemoSection";
import { features, hero } from "@/lib/content";
import { signupUrl, widgetDemoUrl } from "@/lib/links";
import Link from "next/link";

export default function HomePage() {
	return (
		<>
			<section className="relative overflow-hidden bg-gradient-to-bl from-blue-600 via-indigo-600 to-violet-700 text-white">
				<div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
					<h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
						{hero.title}
					</h1>
					<p className="mt-6 max-w-2xl text-lg text-blue-100">{hero.subtitle}</p>
					<ul className="mt-8 grid gap-2 text-sm text-blue-50 sm:grid-cols-2">
						{hero.bullets.map((b) => (
							<li key={b}>✓ {b}</li>
						))}
					</ul>
					<div className="mt-10 flex flex-wrap gap-4">
						<Link
							href={signupUrl}
							className="rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 shadow hover:bg-blue-50"
						>
							شروع رایگان
						</Link>
						<a
							href={widgetDemoUrl}
							className="rounded-xl border border-white/40 px-6 py-3 font-semibold hover:bg-white/10"
						>
							مشاهده دمو
						</a>
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-4 py-20">
				<h2 className="text-center text-2xl font-bold text-slate-900 md:text-3xl">
					هر آنچه برای پشتیبانی حرفه‌ای نیاز دارید
				</h2>
				<div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((f) => (
						<article
							key={f.title}
							className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
						>
							<span className="text-3xl">{f.icon}</span>
							<h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-slate-600">
								{f.desc}
							</p>
						</article>
					))}
				</div>
			</section>

			<WidgetDemoSection />
		</>
	);
}
