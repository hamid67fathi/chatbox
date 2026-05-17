"use client";

import type { Conversation } from "@/lib/api";
import { parseSentimentScore, sentimentMood } from "@/lib/sentiment-mood";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface Props {
	conversations: Conversation[];
	activeId: string | null;
	onSelect: (id: string) => void;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
}

function priorityLabel(priority?: number) {
	if (!priority) return null;
	const map: Record<number, string> = { 1: "!", 2: "!!", 3: "!!!" };
	return map[priority] ?? null;
}

function statusBadge(status: string) {
	const map: Record<string, string> = {
		open: "🟢",
		pending: "🟡",
		resolved: "✅",
		closed: "⚫",
	};
	return map[status] ?? "⚪";
}

function timeAgo(iso: string | null): string {
	if (!iso) return "";
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "الان";
	if (mins < 60) return `${mins} دقیقه پیش`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs} ساعت پیش`;
	return `${Math.floor(hrs / 24)} روز پیش`;
}

export function ConversationList({
	conversations,
	activeId,
	onSelect,
	hasMore,
	loadingMore,
	onLoadMore,
}: Props) {
	const sentinelRef = useRef<HTMLLIElement>(null);

	useEffect(() => {
		if (!hasMore || !onLoadMore) return;
		const el = sentinelRef.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !loadingMore) onLoadMore();
			},
			{ root: el.parentElement, threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasMore, loadingMore, onLoadMore]);

	if (conversations.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
				مکالمه‌ای وجود ندارد
			</div>
		);
	}

	return (
		<ul className="flex-1 overflow-y-auto">
			{conversations.map((conv) => {
				const mood = sentimentMood(parseSentimentScore(conv.sentimentScore));
				return (
				<li key={conv.id}>
					<button
						type="button"
						onClick={() => onSelect(conv.id)}
						className={cn(
							"w-full border-b border-border px-4 py-3 text-start transition-colors hover:bg-accent/50",
							conv.id === activeId && "bg-primary/10",
						)}
					>
						<div className="flex items-start justify-between gap-2">
							<span className="truncate text-sm font-medium">
								<span
									className={cn("me-0.5", mood.className)}
									title={`احساس: ${mood.label}`}
								>
									{mood.emoji}
								</span>
								{priorityLabel(conv.priority) && (
									<span className="me-0.5 text-destructive" title="اولویت">
										{priorityLabel(conv.priority)}
									</span>
								)}
								{statusBadge(conv.status)}{" "}
								{conv.contact?.fullName ?? "Visitor"} · {conv.id.slice(0, 8)}
							</span>
							<span className="shrink-0 text-xs text-muted-foreground">
								{timeAgo(conv.lastMessageAt ?? conv.createdAt)}
							</span>
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
							<span>{conv.channel === "widget" ? "ویجت" : conv.channel}</span>
							{conv.subject && <span>· {conv.subject}</span>}
							{conv.needsHuman && (
								<span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
									نیاز به اپراتور
								</span>
							)}
							{conv.aiHandled && !conv.needsHuman && (
								<span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
									AI
								</span>
							)}
						</div>
					</button>
				</li>
			);
			})}
			{hasMore && (
				<li ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">
					{loadingMore ? "در حال بارگذاری…" : "بارگذاری بیشتر…"}
				</li>
			)}
		</ul>
	);
}
