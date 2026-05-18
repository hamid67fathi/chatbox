"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	type AgentPerformanceReport,
	downloadAgentPerformanceCsv,
	fetchAgentPerformanceReport,
} from "@/lib/api";
import { Download, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Props {
	workspaceId: string;
}

function toDateInputValue(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function dayStartIso(dateStr: string): string {
	return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function dayEndIso(dateStr: string): string {
	return new Date(`${dateStr}T23:59:59.999Z`).toISOString();
}

function defaultRange() {
	const to = new Date();
	const from = new Date();
	from.setUTCDate(from.getUTCDate() - 30);
	return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function formatSec(sec: number | null): string {
	if (sec == null) return "—";
	if (sec < 60) return `${sec} ث`;
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return s > 0 ? `${m} د ${s} ث` : `${m} د`;
}

function agentLabel(row: {
	agent_name: string | null;
	agent_email: string | null;
}): string {
	return row.agent_name ?? row.agent_email ?? "—";
}

export function AgentPerformancePanel({ workspaceId }: Props) {
	const initial = useMemo(() => defaultRange(), []);
	const [fromDate, setFromDate] = useState(initial.from);
	const [toDate, setToDate] = useState(initial.to);
	const [report, setReport] = useState<AgentPerformanceReport | null>(null);
	const [loading, setLoading] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const data = await fetchAgentPerformanceReport(
			workspaceId,
			dayStartIso(fromDate),
			dayEndIso(toDate),
		);
		setReport(data);
		if (!data) setError("بارگذاری گزارش اپراتورها ناموفق بود.");
		setLoading(false);
	}, [workspaceId, fromDate, toDate]);

	useEffect(() => {
		void load();
	}, [load]);

	async function handleExport() {
		setExporting(true);
		const result = await downloadAgentPerformanceCsv(
			workspaceId,
			dayStartIso(fromDate),
			dayEndIso(toDate),
		);
		if (!result.ok) setError(result.error ?? "خروجی CSV ناموفق بود.");
		setExporting(false);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="flex items-center gap-2 text-lg font-semibold">
							<Users className="h-5 w-5" />
							عملکرد اپراتورها
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							مقایسه تیمی — مکالمات، زمان پاسخ، CSAT و نرخ حل
						</p>
					</div>
					<div className="flex flex-wrap gap-3 text-sm">
						<Link href="/reports" className="text-primary hover:underline">
							گزارش مکالمات
						</Link>
						<Link
							href="/reports/overview"
							className="text-primary hover:underline"
						>
							نمای کلی
						</Link>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-end gap-3 border-b border-border px-6 py-4">
				<label className="text-sm">
					<span className="text-muted-foreground">از</span>
					<Input
						type="date"
						className="mt-1"
						value={fromDate}
						onChange={(e) => setFromDate(e.target.value)}
					/>
				</label>
				<label className="text-sm">
					<span className="text-muted-foreground">تا</span>
					<Input
						type="date"
						className="mt-1"
						value={toDate}
						onChange={(e) => setToDate(e.target.value)}
					/>
				</label>
				<Button type="button" onClick={() => void load()} disabled={loading}>
					{loading ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						"به‌روزرسانی"
					)}
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => void handleExport()}
					disabled={exporting || !report?.agents.length}
				>
					<Download className="ms-2 h-4 w-4" />
					{exporting ? "در حال خروجی…" : "CSV"}
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				{error && (
					<p className="mb-4 text-sm text-destructive">{error}</p>
				)}

				{report && (
					<div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-lg border border-border bg-card p-4">
							<p className="text-xs text-muted-foreground">مکالمات (تیم)</p>
							<p className="text-2xl font-semibold">
								{report.team.conversations_total.toLocaleString("fa-IR")}
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-4">
							<p className="text-xs text-muted-foreground">نرخ حل</p>
							<p className="text-2xl font-semibold">
								{report.team.resolution_rate != null
									? `${report.team.resolution_rate}%`
									: "—"}
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-4">
							<p className="text-xs text-muted-foreground">میانگین پاسخ</p>
							<p className="text-2xl font-semibold">
								{formatSec(report.team.avg_first_response_sec)}
							</p>
						</div>
						<div className="rounded-lg border border-border bg-card p-4">
							<p className="text-xs text-muted-foreground">CSAT تیم</p>
							<p className="text-2xl font-semibold">
								{report.team.csat_average != null
									? `${report.team.csat_average} / ۵`
									: "—"}
							</p>
							<p className="text-xs text-muted-foreground">
								{report.team.csat_count.toLocaleString("fa-IR")} پاسخ
							</p>
						</div>
					</div>
				)}

				{loading ? (
					<div className="flex justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : report && report.agents.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						در این بازه داده‌ای برای اپراتورها نیست.
					</p>
				) : report ? (
					<div className="overflow-x-auto rounded-lg border border-border">
						<table className="w-full min-w-[720px] text-sm">
							<thead className="border-b border-border bg-muted/50">
								<tr>
									<th className="px-4 py-3 text-start font-medium">اپراتور</th>
									<th className="px-4 py-3 text-start font-medium">مکالمات</th>
									<th className="px-4 py-3 text-start font-medium">حل‌شده</th>
									<th className="px-4 py-3 text-start font-medium">نرخ حل</th>
									<th className="px-4 py-3 text-start font-medium">پاسخ اول</th>
									<th className="px-4 py-3 text-start font-medium">CSAT</th>
								</tr>
							</thead>
							<tbody>
								{report.agents.map((row) => (
									<tr
										key={row.agent_id}
										className="border-b border-border last:border-0"
									>
										<td className="px-4 py-3">{agentLabel(row)}</td>
										<td className="px-4 py-3">
											{row.conversations_total.toLocaleString("fa-IR")}
										</td>
										<td className="px-4 py-3">
											{row.conversations_resolved.toLocaleString("fa-IR")}
										</td>
										<td className="px-4 py-3">
											{row.resolution_rate != null
												? `${row.resolution_rate}%`
												: "—"}
										</td>
										<td className="px-4 py-3">
											{formatSec(row.avg_first_response_sec)}
										</td>
										<td className="px-4 py-3">
											{row.csat_average != null
												? `${row.csat_average} (${row.csat_count})`
												: "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}

				{report?.refreshed_at && (
					<p className="mt-4 text-xs text-muted-foreground">
						آخرین به‌روزرسانی آمار:{" "}
						{new Date(report.refreshed_at).toLocaleString("fa-IR")}
					</p>
				)}
			</div>
		</div>
	);
}
