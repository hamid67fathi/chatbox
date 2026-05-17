"use client";

import { API_URL, WORKSPACE_SLUG, widgetDemoUrl } from "@/lib/links";
import Link from "next/link";
import { useEffect } from "react";

export function WidgetDemoSection() {
	useEffect(() => {
		const sio = document.createElement("script");
		sio.src = `${API_URL}/socket.io/socket.io.js`;
		sio.async = true;
		document.body.appendChild(sio);

		const w = document.createElement("script");
		w.src = `${API_URL}/widget-demo/dist/index.global.js`;
		w.async = true;
		w.dataset.apiUrl = API_URL;
		w.dataset.workspaceSlug = WORKSPACE_SLUG;
		document.body.appendChild(w);

		return () => {
			sio.remove();
			w.remove();
		};
	}, []);

	return (
		<section className="mx-auto max-w-6xl px-4 py-16">
			<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
				<h2 className="text-2xl font-bold text-slate-900">دمو زنده ویجت</h2>
				<p className="mt-2 max-w-2xl text-slate-600">
					دکمه چت آبی در گوشه صفحه را بزنید. برای تست کامل‌تر{" "}
					<Link href={widgetDemoUrl} className="text-brand underline">
						صفحه دمو ویجت
					</Link>{" "}
					را باز کنید.
				</p>
				<p className="mt-4 text-sm text-slate-500">
					پیش‌نیاز: API روی {API_URL} و workspace با slug «{WORKSPACE_SLUG}»
				</p>
			</div>
		</section>
	);
}
