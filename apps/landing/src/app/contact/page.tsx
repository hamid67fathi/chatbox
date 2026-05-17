import { contactEmail } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "تماس | چت‌باکس",
};

export default function ContactPage() {
	return (
		<div className="mx-auto max-w-xl px-4 py-16">
			<h1 className="text-3xl font-bold text-slate-900">تماس با ما</h1>
			<p className="mt-4 text-slate-600">
				برای سوالات فروش، پشتیبانی فنی یا همکاری با ما در ارتباط باشید.
			</p>
			<div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
				<p className="text-sm text-slate-500">ایمیل</p>
				<a
					href={`mailto:${contactEmail}`}
					className="mt-1 block text-lg font-medium text-brand"
				>
					{contactEmail}
				</a>
			</div>
			<p className="mt-8 text-sm text-slate-500">
				فرم تماس آنلاین به‌زودی اضافه می‌شود. فعلاً از داشبورد یا ایمیل استفاده
				کنید.
			</p>
		</div>
	);
}
