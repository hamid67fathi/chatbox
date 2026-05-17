import Link from "next/link";

export function SiteFooter() {
	return (
		<footer className="mt-20 border-t border-slate-200 bg-white py-10">
			<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 md:flex-row">
				<p>© {new Date().getFullYear()} چت‌باکس — پشتیبانی هوشمند برای کسب‌وکارهای ایرانی</p>
				<div className="flex gap-6">
					<Link href="/pricing/" className="hover:text-brand">
						قیمت‌ها
					</Link>
					<Link href="/contact/" className="hover:text-brand">
						تماس
					</Link>
				</div>
			</div>
		</footer>
	);
}
