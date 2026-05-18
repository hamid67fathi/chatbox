"use client";

import { JourneyTimeline } from "@/components/contact/JourneyTimeline";
import type {
	ContactVisitorEvent,
	JourneyItem,
	VisitorInfo,
	VisitorPageView,
} from "@/lib/api";
import {
	fetchContactJourney,
	fetchContactVisitorEvents,
	fetchConversationDetail,
	updateContactLifecycle,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { ExternalLink, Globe, History, MapPin, Monitor } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	conversationId: string;
	channel: string;
	canEditContact?: boolean;
}

const LIFECYCLE_STAGES = [
	{ value: "new", label: "جدید" },
	{ value: "lead", label: "لید" },
	{ value: "prospect", label: "پیش‌نمایش" },
	{ value: "customer", label: "مشتری" },
	{ value: "vip", label: "VIP" },
	{ value: "at_risk", label: "در خطر" },
	{ value: "churned", label: "ریزش" },
	{ value: "reactivated", label: "بازگشت" },
];

function deviceLabel(device: string | null | undefined): string {
	if (device === "mobile") return "موبایل";
	if (device === "tablet") return "تبلت";
	if (device === "desktop") return "دسکتاپ";
	return device ?? "—";
}

function eventLabel(type: string): string {
	const labels: Record<string, string> = {
		page_view: "بازدید صفحه",
		session_start: "شروع نشست",
		session_end: "پایان نشست",
		conversation_started: "شروع مکالمه",
		custom_event: "رویداد سفارشی",
	};
	return labels[type] ?? type;
}

function formatPagePath(url: string): string {
	try {
		const u = new URL(url);
		return u.pathname + u.search;
	} catch {
		return url;
	}
}

export function VisitorInfoPanel({
	workspaceId,
	conversationId,
	channel,
	canEditContact = false,
}: Props) {
	const [visitor, setVisitor] = useState<VisitorInfo | null>(null);
	const [events, setEvents] = useState<ContactVisitorEvent[]>([]);
	const [journey, setJourney] = useState<JourneyItem[]>([]);
	const [contactId, setContactId] = useState<string | null>(null);
	const [lifecycle, setLifecycle] = useState("new");
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (channel !== "widget") {
			setVisitor(null);
			setEvents([]);
			return;
		}
		setLoading(true);
		const detail = await fetchConversationDetail(workspaceId, conversationId);
		setVisitor(detail?.visitor ?? null);
		if (detail?.contactId) {
			setContactId(detail.contactId);
			const ev = await fetchContactVisitorEvents(workspaceId, detail.contactId);
			setEvents(ev.rows);
			setJourney(await fetchContactJourney(workspaceId, detail.contactId));
			const c = detail.contact as { lifecycle_stage?: string; lifecycleStage?: string } | undefined;
			setLifecycle(c?.lifecycle_stage ?? c?.lifecycleStage ?? "new");
		} else {
			setContactId(null);
			setEvents([]);
			setJourney([]);
		}
		setLoading(false);
	}, [workspaceId, conversationId, channel]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (channel !== "widget") return;
		const socket = getSocket(workspaceId);
		const onContext = (data: {
			conversation_id?: string;
			visitor?: VisitorInfo | null;
		}) => {
			if (data.conversation_id !== conversationId) return;
			if (data.visitor) setVisitor(normalizeVisitor(data.visitor));
		};
		socket.on("visitor:context", onContext);
		return () => {
			socket.off("visitor:context", onContext);
		};
	}, [workspaceId, conversationId, channel]);

	if (channel !== "widget") return null;

	const pageViews = visitor?.page_views ?? [];

	return (
		<div className="max-h-64 overflow-y-auto border-b border-border bg-muted/30 px-4 py-3">
			<p className="mb-2 text-xs font-semibold text-muted-foreground">
				اطلاعات بازدیدکننده
			</p>
			{loading && !visitor ? (
				<p className="text-xs text-muted-foreground">در حال بارگذاری…</p>
			) : !visitor ? (
				<p className="text-xs text-muted-foreground">
					هنوز اطلاعاتی ثبت نشده (بازدیدکننده باید ویجت را باز کند).
				</p>
			) : (
				<div className="space-y-3">
					<div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
						<div className="flex items-start gap-2">
							<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-xs text-muted-foreground">کشور / IP</p>
								<p className="font-medium">
									{visitor.country ?? visitor.country_code ?? "—"}
								</p>
								<p className="font-mono text-xs text-muted-foreground" dir="ltr">
									{visitor.ip ?? "—"}
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-xs text-muted-foreground">دستگاه</p>
								<p className="font-medium">{deviceLabel(visitor.device)}</p>
								<p className="text-xs text-muted-foreground">
									{visitor.browser ?? "—"} · {visitor.os ?? "—"}
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2 sm:col-span-2">
							<Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<p className="text-xs text-muted-foreground">صفحه فعلی</p>
								{visitor.current_page_url ? (
									<a
										href={visitor.current_page_url}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 break-all text-primary hover:underline"
										dir="ltr"
									>
										<span className="line-clamp-2 text-xs">
											{visitor.current_page_url}
										</span>
										<ExternalLink className="h-3 w-3 shrink-0" />
									</a>
								) : (
									<p>—</p>
								)}
							</div>
						</div>
					</div>

					{contactId && (
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<span className="text-muted-foreground">مرحله عمر:</span>
							<select
								className="rounded border border-border bg-background px-2 py-1"
								value={lifecycle}
								disabled={!canEditContact}
								onChange={(e) => {
									const stage = e.target.value;
									setLifecycle(stage);
									void updateContactLifecycle(workspaceId, contactId, stage);
								}}
							>
								{LIFECYCLE_STAGES.map((s) => (
									<option key={s.value} value={s.value}>
										{s.label}
									</option>
								))}
							</select>
						</div>
					)}

					{journey.length > 0 && (
						<div>
							<p className="mb-1 text-xs font-semibold text-muted-foreground">
								نقشه سفر مشتری
							</p>
							<JourneyTimeline items={journey} />
						</div>
					)}

					{events.length > 0 && (
						<div>
							<p className="mb-1 text-xs font-semibold text-muted-foreground">
								رویدادهای ردیابی
							</p>
							<ul className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border bg-background/80 p-2 text-xs">
								{events.map((ev) => (
									<li
										key={ev.id}
										className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-1 last:border-0"
									>
										<span className="font-medium">{eventLabel(ev.event_type)}</span>
										<time className="text-muted-foreground" dateTime={ev.created_at}>
											{new Date(ev.created_at).toLocaleString("fa-IR", {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</time>
										{ev.url && (
											<span
												className="w-full truncate text-primary"
												dir="ltr"
												title={ev.url}
											>
												{formatPagePath(ev.url)}
											</span>
										)}
									</li>
								))}
							</ul>
						</div>
					)}

					<div>
						<p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
							<History className="h-3.5 w-3.5" />
							سابقه بازدید صفحات
						</p>
						{pageViews.length === 0 ? (
							<p className="text-xs text-muted-foreground">هنوز صفحه‌ای ثبت نشده.</p>
						) : (
							<ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border bg-background/80 p-2 text-xs">
								{pageViews.map((p, i) => (
									<li
										key={`${p.at}-${i}`}
										className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-1 last:border-0 last:pb-0"
									>
										<a
											href={p.url}
											target="_blank"
											rel="noopener noreferrer"
											className="min-w-0 flex-1 truncate text-primary hover:underline"
											dir="ltr"
											title={p.url}
										>
											{p.title?.trim() || formatPagePath(p.url)}
										</a>
										<time
											className="shrink-0 text-muted-foreground"
											dateTime={p.at}
										>
											{new Date(p.at).toLocaleString("fa-IR", {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</time>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function normalizeVisitor(raw: VisitorInfo): VisitorInfo {
	return {
		ip: raw.ip ?? null,
		country: raw.country ?? null,
		country_code: raw.country_code ?? raw.countryCode ?? null,
		current_page_url: raw.current_page_url ?? raw.currentPageUrl ?? null,
		current_page_url_at:
			raw.current_page_url_at ?? raw.currentPageUrlAt ?? null,
		browser: raw.browser ?? null,
		os: raw.os ?? null,
		device: raw.device ?? null,
		utm: raw.utm,
		updated_at: raw.updated_at ?? raw.updatedAt ?? null,
		page_views: normalizePageViews(raw.page_views),
	};
}

function normalizePageViews(raw: unknown): VisitorPageView[] {
	if (!Array.isArray(raw)) return [];
	const out: VisitorPageView[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		if (typeof o.url !== "string" || typeof o.at !== "string") continue;
		out.push({
			url: o.url,
			title: typeof o.title === "string" ? o.title : null,
			at: o.at,
		});
	}
	return out;
}
