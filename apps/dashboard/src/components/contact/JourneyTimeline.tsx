"use client";

import type { JourneyItem } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
	conversation: "مکالمه",
	"lifecycle.change": "تغییر مرحله عمر",
	"event.page_view": "بازدید صفحه",
	"event.custom_event": "رویداد سفارشی",
	"event.session_start": "شروع نشست",
	"event.session_end": "پایان نشست",
};

export function JourneyTimeline({ items }: { items: JourneyItem[] }) {
	if (items.length === 0) {
		return (
			<p className="text-xs text-muted-foreground">سفری برای نمایش ثبت نشده.</p>
		);
	}

	return (
		<ul className="relative space-y-3 border-s-2 border-primary/20 ps-4 text-xs">
			{items.map((item) => (
				<li key={item.id} className="relative">
					<span className="absolute -start-[1.35rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
					<p className="font-medium">
						{TYPE_LABELS[item.type] ?? item.title ?? item.type}
					</p>
					{item.detail && (
						<p className="truncate text-muted-foreground" dir="ltr" title={item.detail}>
							{item.detail}
						</p>
					)}
					<time className="text-muted-foreground" dateTime={item.occurred_at}>
						{new Date(item.occurred_at).toLocaleString("fa-IR")}
					</time>
				</li>
			))}
		</ul>
	);
}
