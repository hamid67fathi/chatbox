import Link from "next/link";
import { loginUrl, signupUrl } from "@/lib/links";

const nav = [
	{ href: "/", label: "خانه" },
	{ href: "/pricing/", label: "قیمت‌ها" },
	{ href: "/about/", label: "درباره ما" },
	{ href: "/contact/", label: "تماس" },
];

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
				<Link href="/" className="flex items-center gap-2 font-bold text-brand">
					<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm text-white">
						CB
					</span>
					چت‌باکس
				</Link>
				<nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
					{nav.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className="hover:text-brand transition-colors"
						>
							{item.label}
						</Link>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<Link
						href={loginUrl}
						className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
					>
						ورود
					</Link>
					<Link
						href={signupUrl}
						className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
					>
						شروع رایگان
					</Link>
				</div>
			</div>
		</header>
	);
}
