import { aboutText } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "درباره ما | چت‌باکس",
};

export default function AboutPage() {
	return (
		<div className="mx-auto max-w-3xl px-4 py-16">
			<h1 className="text-3xl font-bold text-slate-900">درباره چت‌باکس</h1>
			<p className="mt-6 text-lg leading-relaxed text-slate-600">{aboutText}</p>
			<p className="mt-6 text-slate-600">
				ما معتقدیم پشتیبانی آنلاین در ایران باید بومی، سریع و مقرون‌به‌صرفه باشد —
				با AI که واقعاً فارسی را درک کند و در صورت نیاز به انسان وصل شود.
			</p>
		</div>
	);
}
