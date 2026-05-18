"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Contact, ContactTimelineEvent, TimelineEventType } from "@/lib/api";
import { fetchContactTimeline } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	contact: Contact;
}

const CHANNELS = [
	{ value: "", label: "همه کانال‌ها" },
	{ value: "widget", label: "ویجت" },
	{ value: "telegram", label: "تلگرام" },
	{ value: "email", label: "ایمیل" },
	{ value: "whatsapp", label: "واتساپ" },
];

const TYPE_LABELS: Record<TimelineEventType, string> = {
	conversation_started: "شروع مکالمه",
	message: "پیام",
	note: "یادداشت تیم",
	tag_added: "افزودن تگ",
	conversation_resolved: "حل‌شده",
	conversation_closed: "بسته‌شده",
};

function formatWhen(iso: string) {
	try {
		return new Date(iso).toLocaleString("fa-IR", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	} catch {
		return iso;
	}
}

function eventDescription(ev: ContactTimelineEvent): string {
	const p = ev.payload;
	switch (ev.type) {
		case "conversation_started":
			return (p.subject as string) || `وضعیت: ${String(p.status ?? "open")}`;
		case "message":
			return `${p.sender_type === "contact" ? "مشتری" : p.sender_type === "agent" ? "اپراتور" : String(p.sender_type)}: ${String(p.body ?? "")}`;
		case "note": {
			const author = p.author as { full_name?: string; email?: string } | null;
			const who = author?.full_name || author?.email || "تیم";
			return `${who}: ${String(p.body ?? "")}`;
		}
		case "tag_added":
			return `تگ «${String(p.tag ?? "")}»`;
		case "conversation_resolved":
			return "مکالمه حل‌شده علامت خورد";
		case "conversation_closed":
			return "مکالمه بسته شد";
		default:
			return "";
	}
}

export function ContactTimelinePanel({ workspaceId, contact }: Props) {
	const [channel, setChannel] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [events, setEvents] = useState<ContactTimelineEvent[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);

	const load = useCallback(
		async (append = false, nextCursor?: string | null) => {
			if (append) setLoadingMore(true);
			else setLoading(true);

			const result = await fetchContactTimeline(workspaceId, contact.id, {
				channel: channel || undefined,
				from: from ? new Date(from).toISOString() : undefined,
				to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
				limit: 40,
				cursor: append ? (nextCursor ?? undefined) : undefined,
			});

			setEvents((prev) =>
				append ? [...prev, ...result.events] : result.events,
			);
			setCursor(result.next_cursor);
			setLoading(false);
			setLoadingMore(false);
		},
		[workspaceId, contact.id, channel, from, to],
	);

	useEffect(() => {
		void load(false);
	}, [load]);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">
					{contact.fullName || contact.email || contact.phone || "مخاطب"}
				</h1>
				<p className="text-sm text-muted-foreground">
					{contact.email}
					{contact.email && contact.phone ? " · " : ""}
					{contact.phone}
				</p>
				{contact.tags.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{contact.tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-wrap items-end gap-3 border-b border-border px-6 py-3">
				<label className="text-sm">
					<span className="mb-1 block text-xs text-muted-foreground">کانال</span>
					<select
						className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
						value={channel}
						onChange={(e) => setChannel(e.target.value)}
					>
						{CHANNELS.map((c) => (
							<option key={c.value || "all"} value={c.value}>
								{c.label}
							</option>
						))}
					</select>
				</label>
				<label className="text-sm">
					<span className="mb-1 block text-xs text-muted-foreground">از تاریخ</span>
					<Input
						type="date"
						className="h-9 w-40"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
					/>
				</label>
				<label className="text-sm">
					<span className="mb-1 block text-xs text-muted-foreground">تا تاریخ</span>
					<Input
						type="date"
						className="h-9 w-40"
						value={to}
						onChange={(e) => setTo(e.target.value)}
					/>
				</label>
				<Button type="button" size="sm" variant="outline" onClick={() => void load(false)}>
					اعمال فیلتر
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
				{loading ? (
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						در حال بارگذاری…
					</div>
				) : events.length === 0 ? (
					<p className="text-sm text-muted-foreground">رویدادی یافت نشد.</p>
				) : (
					<ul className="space-y-3">
						{events.map((ev) => (
							<li
								key={ev.id}
								className="rounded-lg border border-border bg-card p-3 text-sm"
							>
								<div className="mb-1 flex flex-wrap items-center justify-between gap-2">
									<span
										className={cn(
											"rounded-full px-2 py-0.5 text-xs font-medium",
											ev.type === "message"
												? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
												: ev.type === "note"
													? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
													: "bg-muted text-muted-foreground",
										)}
									>
										{TYPE_LABELS[ev.type]}
									</span>
									<span className="text-xs text-muted-foreground">
										{formatWhen(ev.occurred_at)} · {ev.channel}
									</span>
								</div>
								<p className="whitespace-pre-wrap leading-relaxed">
									{eventDescription(ev)}
								</p>
								<Link
									href={`/?conversation=${ev.conversation_id}`}
									className="mt-2 inline-block text-xs text-primary hover:underline"
								>
									مشاهده در صندوق ورودی
								</Link>
							</li>
						))}
					</ul>
				)}
				{cursor && !loading && (
					<div className="mt-4 flex justify-center">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={loadingMore}
							onClick={() => void load(true, cursor)}
						>
							{loadingMore ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"بارگذاری بیشتر"
							)}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
