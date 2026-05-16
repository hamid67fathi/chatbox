"use client";

import { Button } from "@/components/ui/button";
import {
	type CopilotSuggestion,
	type CopilotStreamEvent,
	streamCopilotSuggestions,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const PLACEHOLDER_LABELS = ["مختصر", "دوستانه", "مفصل"];

interface Props {
	workspaceId: string;
	conversationId: string;
	open: boolean;
	onClose: () => void;
	onSelect: (text: string) => void;
}

export function CopilotSuggestions({
	workspaceId,
	conversationId,
	open,
	onClose,
	onSelect,
}: Props) {
	const [items, setItems] = useState<(CopilotSuggestion | null)[]>([
		null,
		null,
		null,
	]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	const reset = useCallback(() => {
		setItems([null, null, null]);
		setError("");
	}, []);

	const run = useCallback(async () => {
		abortRef.current?.abort();
		const ac = new AbortController();
		abortRef.current = ac;
		reset();
		setLoading(true);

		const onEvent = (event: CopilotStreamEvent) => {
			if (event.type === "suggestion") {
				setItems((prev) => {
					const next = [...prev];
					const i = Math.min(2, Math.max(0, event.index));
					next[i] = {
						style: event.style,
						label: event.label,
						text: event.text,
					};
					return next;
				});
			}
			if (event.type === "error") {
				setError(event.message ?? "خطا در دریافت پیشنهادها.");
			}
		};

		const result = await streamCopilotSuggestions(
			workspaceId,
			conversationId,
			onEvent,
			ac.signal,
		);

		setLoading(false);
		if (!result.ok && result.error && result.error !== "لغو شد.") {
			setError(result.error);
		}
	}, [workspaceId, conversationId, reset]);

	useEffect(() => {
		if (open) {
			void run();
		} else {
			abortRef.current?.abort();
			setLoading(false);
		}
		return () => abortRef.current?.abort();
	}, [open, run]);

	if (!open) return null;

	return (
		<div className="border-t border-border bg-muted/40 px-4 py-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="text-sm font-medium">پیشنهادهای AI</p>
				<div className="flex gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 text-xs"
						disabled={loading}
						onClick={() => void run()}
					>
						تازه‌سازی
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 text-xs"
						onClick={onClose}
					>
						بستن
					</Button>
				</div>
			</div>
			{error && <p className="mb-2 text-xs text-destructive">{error}</p>}
			<div className="grid gap-2 sm:grid-cols-3">
				{items.map((item, i) => (
					<button
						key={item?.style ?? `slot-${i}`}
						type="button"
						disabled={!item?.text || loading}
						onClick={() => {
							if (item?.text) {
								onSelect(item.text);
								onClose();
							}
						}}
						className={cn(
							"rounded-lg border border-border bg-card p-3 text-start text-sm transition-colors",
							item?.text &&
								"hover:border-primary hover:bg-primary/5 cursor-pointer",
							!item?.text && "animate-pulse opacity-70",
						)}
					>
						<span className="mb-1 block text-xs font-medium text-muted-foreground">
							{item?.label ?? PLACEHOLDER_LABELS[i]}
						</span>
						<span className="line-clamp-4 whitespace-pre-wrap text-foreground">
							{item?.text ?? (loading ? "در حال تولید…" : "—")}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
