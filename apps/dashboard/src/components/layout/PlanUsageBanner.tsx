"use client";

import { fetchPlanUsage, type PlanUsageStatus, type UsageMetric } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
	workspaceId: string;
}

function worstMetric(status: PlanUsageStatus): UsageMetric | null {
	const metrics = [
		status.members,
		status.conversationsMonth,
		status.uploadBytesMonth,
	];
	const exhausted = metrics.find((m) => m.level === "exhausted");
	if (exhausted) return exhausted;
	return metrics.find((m) => m.level === "warning") ?? null;
}

function formatUsed(m: UsageMetric): string {
	if (m.unit === "bytes") {
		const mb = m.used / (1024 * 1024);
		const lim =
			m.limit != null ? ` / ${Math.round(m.limit / (1024 * 1024))} MB` : "";
		return `${mb.toFixed(1)} MB${lim}`;
	}
	const lim = m.limit != null ? ` / ${m.limit}` : "";
	return `${m.used}${lim}`;
}

export function PlanUsageBanner({ workspaceId }: Props) {
	const [status, setStatus] = useState<PlanUsageStatus | null>(null);

	useEffect(() => {
		void fetchPlanUsage(workspaceId).then(setStatus);
	}, [workspaceId]);

	useEffect(() => {
		const socket = getSocket();
		if (!socket) return;
		const onUsage = (payload: {
			members?: UsageMetric;
			conversations_month?: UsageMetric;
			upload_bytes_month?: UsageMetric;
			level?: string;
		}) => {
			setStatus((prev) =>
				prev
					? {
							...prev,
							members: payload.members ?? prev.members,
							conversationsMonth:
								payload.conversations_month ?? prev.conversationsMonth,
							uploadBytesMonth:
								payload.upload_bytes_month ?? prev.uploadBytesMonth,
						}
					: prev,
			);
		};
		socket.on("workspace:plan_usage", onUsage);
		return () => {
			socket.off("workspace:plan_usage", onUsage);
		};
	}, [workspaceId]);

	const metric = status ? worstMetric(status) : null;
	if (!metric || metric.level === "ok" || metric.level === "unlimited") {
		return null;
	}

	const isExhausted = metric.level === "exhausted";

	return (
		<div
			className={
				isExhausted
					? "border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
					: "border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
			}
		>
			<p className="flex flex-wrap items-center gap-2">
				<AlertTriangle className="h-4 w-4 shrink-0" />
				<span>
					{isExhausted ? "سقف پلن پر شده:" : "نزدیک سقف پلن:"}{" "}
					<strong>{metric.label}</strong> — {formatUsed(metric)}
				</span>
				<Link href="/billing" className="underline underline-offset-2">
					ارتقای پلن
				</Link>
			</p>
		</div>
	);
}
