"use client";

import { Button } from "@/components/ui/button";
import type { HandoffBrief } from "@/lib/api";
import { fetchHandoffBrief, refreshHandoffBrief } from "@/lib/api";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	conversationId: string;
	needsHuman?: boolean;
	initialBrief?: HandoffBrief | null;
	onBriefChange?: (brief: HandoffBrief | null) => void;
	onUseSuggestedReply?: (text: string) => void;
}

export function HandoffBriefPanel({
	workspaceId,
	conversationId,
	needsHuman,
	initialBrief,
	onBriefChange,
	onUseSuggestedReply,
}: Props) {
	const [brief, setBrief] = useState<HandoffBrief | null>(initialBrief ?? null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const data = await fetchHandoffBrief(workspaceId, conversationId);
		setBrief(data);
		onBriefChange?.(data);
		if (!data && needsHuman) {
			setError("بریف ارجاع هنوز آماده نیست.");
		}
		setLoading(false);
	}, [workspaceId, conversationId, needsHuman, onBriefChange]);

	useEffect(() => {
		setBrief(initialBrief ?? null);
	}, [initialBrief]);

	useEffect(() => {
		if (needsHuman && !brief && !loading) {
			void load();
		}
	}, [needsHuman, brief, loading, load]);

	if (!needsHuman && !brief) return null;

	async function handleRefresh() {
		setLoading(true);
		setError(null);
		const data = await refreshHandoffBrief(workspaceId, conversationId);
		setBrief(data);
		onBriefChange?.(data);
		if (!data) setError("تهیه بریف ناموفق بود. ai-service را بررسی کنید.");
		setLoading(false);
	}

	return (
		<div className="shrink-0 border-b border-amber-500/30 bg-amber-500/5 px-4 py-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
					<AlertCircle className="h-4 w-4" />
					بریف ارجاع به اپراتور
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 text-xs"
					disabled={loading}
					onClick={() => void handleRefresh()}
				>
					{loading ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : (
						"بروزرسانی"
					)}
				</Button>
			</div>

			{loading && !brief && (
				<p className="text-sm text-muted-foreground">در حال تهیه بریف…</p>
			)}
			{error && <p className="text-sm text-destructive">{error}</p>}

			{brief && (
				<div className="space-y-3 text-sm">
					{brief.context && (
						<div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
							{brief.context.channel && (
								<span className="rounded-full bg-muted px-2 py-0.5">
									{brief.context.channel}
								</span>
							)}
							{brief.context.contact_name && (
								<span className="rounded-full bg-muted px-2 py-0.5">
									{brief.context.contact_name}
								</span>
							)}
							{brief.context.tags?.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-primary/10 px-2 py-0.5 text-primary"
								>
									{tag}
								</span>
							))}
						</div>
					)}
					<div>
						<p className="mb-1 text-xs font-medium text-muted-foreground">
							خلاصه
						</p>
						<p className="whitespace-pre-wrap leading-relaxed">
							{brief.summary}
						</p>
					</div>
					{brief.key_points.length > 0 && (
						<div>
							<p className="mb-1 text-xs font-medium text-muted-foreground">
								نکات کلیدی
							</p>
							<ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
								{brief.key_points.map((p) => (
									<li key={p}>{p}</li>
								))}
							</ul>
						</div>
					)}
					{brief.suggested_reply && (
						<div className="rounded-md border border-border bg-card p-3">
							<div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
								<Sparkles className="h-3 w-3" />
								پیشنهاد پاسخ
							</div>
							<p className="whitespace-pre-wrap">{brief.suggested_reply}</p>
							{onUseSuggestedReply && (
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="mt-2 h-7 text-xs"
									onClick={() =>
										onUseSuggestedReply(brief.suggested_reply)
									}
								>
									استفاده در پاسخ
								</Button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
