"use client";

import type { VisitorInfo } from "@/lib/api";
import { fetchConversationDetail } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { ExternalLink, Globe, Monitor, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	conversationId: string;
	channel: string;
}

function deviceLabel(device: string | null | undefined): string {
	if (device === "mobile") return "موبایل";
	if (device === "tablet") return "تبلت";
	if (device === "desktop") return "دسکتاپ";
	return device ?? "—";
}

export function VisitorInfoPanel({
	workspaceId,
	conversationId,
	channel,
}: Props) {
	const [visitor, setVisitor] = useState<VisitorInfo | null>(null);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (channel !== "widget") {
			setVisitor(null);
			return;
		}
		setLoading(true);
		const detail = await fetchConversationDetail(workspaceId, conversationId);
		setVisitor(detail?.visitor ?? null);
		setLoading(false);
	}, [workspaceId, conversationId, channel]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (channel !== "widget") return;
		const socket = getSocket();
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
	}, [conversationId, channel]);

	if (channel !== "widget") return null;

	return (
		<div className="border-b border-border bg-muted/30 px-4 py-3">
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
	};
}
