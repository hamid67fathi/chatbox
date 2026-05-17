"use client";

import { fetchAiUsage, type AiBudgetStatus } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
}

export function AiBudgetBanner({ workspaceId }: Props) {
	const [status, setStatus] = useState<AiBudgetStatus | null>(null);

	const load = useCallback(async () => {
		const data = await fetchAiUsage(workspaceId);
		setStatus(data);
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		const socket = getSocket(workspaceId);

		const onBudget = (payload: {
			level?: string;
			used_credits?: number;
			total_limit?: number | null;
			percent_used?: number | null;
		}) => {
			setStatus((prev) =>
				prev
					? {
							...prev,
							usedCredits: payload.used_credits ?? prev.usedCredits,
							totalLimit: payload.total_limit ?? prev.totalLimit,
							percentUsed: payload.percent_used ?? prev.percentUsed,
							level:
								(payload.level as AiBudgetStatus["level"]) ?? prev.level,
							allowAi: payload.level !== "exhausted",
							remainingCredits:
								payload.total_limit != null && payload.used_credits != null
									? Math.max(0, payload.total_limit - payload.used_credits)
									: prev.remainingCredits,
						}
					: prev,
			);
			void load();
		};

		socket.on("workspace:ai_budget", onBudget);
		return () => {
			socket.off("workspace:ai_budget", onBudget);
		};
	}, [workspaceId, load]);

	if (!status || status.level === "ok" || status.level === "unlimited") {
		return null;
	}

	const exhausted = status.level === "exhausted";
	const pct =
		status.percentUsed != null ? Math.round(status.percentUsed) : null;

	return (
		<div
			className={`flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm ${
				exhausted
					? "border-destructive/30 bg-destructive/10 text-destructive"
					: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
			}`}
			role="status"
		>
			{exhausted ? (
				<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
			) : (
				<Sparkles className="h-4 w-4 shrink-0" aria-hidden />
			)}
			<p className="min-w-0 flex-1">
				{exhausted ? (
					<>
						اعتبار AI این ماه تمام شده است
						{status.totalLimit != null && (
							<span className="opacity-80">
								{" "}
								({status.usedCredits} / {status.totalLimit} اعتبار)
							</span>
						)}
						. پاسخ خودکار و Copilot غیرفعال است — لطفاً پلن را ارتقا دهید.
					</>
				) : (
					<>
						{pct != null ? `${pct}٪` : "بیش از ۸۰٪"} از اعتبار AI ماهانه مصرف شده
						{status.totalLimit != null && (
							<span className="opacity-80">
								{" "}
								({status.usedCredits} / {status.totalLimit})
							</span>
						)}
						.
					</>
				)}
			</p>
		</div>
	);
}
