"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	type ReportsOverview,
	downloadReportsOverviewCsv,
	fetchReportsOverview,
} from "@/lib/api";
import { Download, LayoutDashboard, Loader2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

interface Props {
	workspaceId: string;
}

const CHANNEL_LABELS: Record<string, string> = {
	widget: "ویجت",
	telegram: "تلگرام",
	email: "ایمیل",
	whatsapp: "واتساپ",
	api: "API",
};

const CHART_COLORS = [
	"#2563eb",
	"#7c3aed",
	"#059669",
	"#d97706",
	"#dc2626",
	"#0891b2",
];

const DOW_SHORT = ["ی", "د", "س", "چ", "پ", "ج", "ش"];

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

function heatColor(count: number, max: number): string {
	if (max <= 0 || count <= 0) return "rgb(var(--muted) / 0.35)";
	const t = count / max;
	const alpha = 0.15 + t * 0.85;
	return `hsl(221 83% 53% / ${alpha})`;
}

export function ReportsOverviewPanel({ workspaceId }: Props) {
	const initial = useMemo(() => defaultRange(), []);
	const [fromDate, setFromDate] = useState(initial.from);
	const [toDate, setToDate] = useState(initial.to);
	const [data, setData] = useState<ReportsOverview | null>(null);
	const [loading, setLoading] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const overview = await fetchReportsOverview(
			workspaceId,
			dayStartIso(fromDate),
			dayEndIso(toDate),
		);
		setData(overview);
		if (!overview) setError("بارگذاری گزارش نمای کلی ناموفق بود.");
		setLoading(false);
	}, [workspaceId, fromDate, toDate]);

	useEffect(() => {
		void load();
	}, [load]);

	const lineData = useMemo(
		() =>
			data?.conversations_over_time.map((r) => ({
				day: r.day.slice(5),
				ایجاد: r.created,
				حل‌شده: r.resolved,
			})) ?? [],
		[data],
	);

	const channelData = useMemo(
		() =>
			data?.channels.map((c) => ({
				name: CHANNEL_LABELS[c.channel] ?? c.channel,
				value: c.count,
			})) ?? [],
		[data],
	);

	const tagData = useMemo(
		() =>
			data?.top_tags.map((t) => ({
				tag: t.tag,
				count: t.count,
			})) ?? [],
		[data],
	);

	const heatMax = useMemo(() => {
		if (!data?.peak_hours.length) return 0;
		return Math.max(...data.peak_hours.map((h) => h.count));
	}, [data]);

	const heatGrid = useMemo(() => {
		const grid: number[][] = Array.from({ length: 7 }, () =>
			Array(24).fill(0),
		);
		for (const cell of data?.peak_hours ?? []) {
			if (cell.dow >= 0 && cell.dow < 7 && cell.hour >= 0 && cell.hour < 24) {
				grid[cell.dow][cell.hour] = cell.count;
			}
		}
		return grid;
	}, [data]);

	const funnelSteps = useMemo(() => {
		if (!data) return [];
		const { funnel } = data;
		const base = funnel.started || 1;
		return [
			{ label: "شروع مکالمه", count: funnel.started, pct: 100 },
			{
				label: "پاسخ اپراتور",
				count: funnel.agent_replied,
				pct: Math.round((funnel.agent_replied / base) * 100),
			},
			{
				label: "حل‌شده",
				count: funnel.resolved,
				pct: Math.round((funnel.resolved / base) * 100),
			},
			{
				label: "بسته",
				count: funnel.closed,
				pct: Math.round((funnel.closed / base) * 100),
			},
		];
	}, [data]);

	async function handleExport() {
		setExporting(true);
		const result = await downloadReportsOverviewCsv(
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
							<LayoutDashboard className="h-5 w-5" />
							نمای کلی گزارش‌ها
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							روند مکالمات، کانال‌ها، ساعات اوج، تگ‌ها و قیف رزولوشن
						</p>
					</div>
					<div className="flex flex-wrap gap-3 text-sm">
						<Link href="/reports" className="text-primary hover:underline">
							گزارش مکالمات
						</Link>
						<Link
							href="/reports/agents"
							className="text-primary hover:underline"
						>
							عملکرد اپراتور
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
					disabled={exporting || !data}
				>
					<Download className="ms-2 h-4 w-4" />
					{exporting ? "در حال خروجی…" : "CSV"}
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				{error && (
					<p className="mb-4 text-sm text-destructive">{error}</p>
				)}

				{loading ? (
					<div className="flex justify-center py-16">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : data ? (
					<div className="grid gap-6 xl:grid-cols-2">
						<section className="rounded-lg border border-border bg-card p-4 xl:col-span-2">
							<h2 className="mb-4 text-sm font-semibold">
								مکالمات در طول زمان
							</h2>
							{lineData.length === 0 ? (
								<p className="text-sm text-muted-foreground">داده‌ای نیست.</p>
							) : (
								<div className="h-64 w-full" dir="ltr">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart data={lineData}>
											<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
											<XAxis dataKey="day" tick={{ fontSize: 11 }} />
											<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
											<Tooltip />
											<Legend />
											<Line
												type="monotone"
												dataKey="ایجاد"
												stroke="#2563eb"
												strokeWidth={2}
												dot={false}
											/>
											<Line
												type="monotone"
												dataKey="حل‌شده"
												stroke="#059669"
												strokeWidth={2}
												dot={false}
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
							)}
						</section>

						<section className="rounded-lg border border-border bg-card p-4">
							<h2 className="mb-4 text-sm font-semibold">توزیع کانال</h2>
							{channelData.length === 0 ? (
								<p className="text-sm text-muted-foreground">داده‌ای نیست.</p>
							) : (
								<div className="h-56 w-full" dir="ltr">
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={channelData}
												dataKey="value"
												nameKey="name"
												cx="50%"
												cy="50%"
												outerRadius={80}
												label={({ name, percent }) =>
													`${name} ${((percent ?? 0) * 100).toFixed(0)}%`
												}
											>
												{channelData.map((_, i) => (
													<Cell
														key={i}
														fill={CHART_COLORS[i % CHART_COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip />
										</PieChart>
									</ResponsiveContainer>
								</div>
							)}
						</section>

						<section className="rounded-lg border border-border bg-card p-4">
							<h2 className="mb-4 text-sm font-semibold">تگ‌های پرکاربرد</h2>
							{tagData.length === 0 ? (
								<p className="text-sm text-muted-foreground">داده‌ای نیست.</p>
							) : (
								<div className="h-56 w-full" dir="ltr">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={tagData} layout="vertical" margin={{ left: 8 }}>
											<CartesianGrid strokeDasharray="3 3" opacity={0.3} />
											<XAxis type="number" allowDecimals={false} />
											<YAxis
												type="category"
												dataKey="tag"
												width={72}
												tick={{ fontSize: 11 }}
											/>
											<Tooltip />
											<Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
										</BarChart>
									</ResponsiveContainer>
								</div>
							)}
						</section>

						<section className="rounded-lg border border-border bg-card p-4 xl:col-span-2">
							<h2 className="mb-2 text-sm font-semibold">
								heatmap ساعات اوج (UTC)
							</h2>
							<p className="mb-3 text-xs text-muted-foreground">
								تعداد مکالمات شروع‌شده بر اساس روز هفته و ساعت
							</p>
							<div className="overflow-x-auto" dir="ltr">
								<div
									className="grid gap-px text-[10px]"
									style={{
										gridTemplateColumns: "2rem repeat(24, minmax(1.1rem, 1fr))",
									}}
								>
									<div />
									{Array.from({ length: 24 }, (_, h) => (
										<div
											key={h}
											className="text-center text-muted-foreground"
										>
											{h}
										</div>
									))}
									{heatGrid.map((row, dow) => (
										<Fragment key={dow}>
											<div className="flex items-center justify-end pe-1 text-muted-foreground">
												{DOW_SHORT[dow]}
											</div>
											{row.map((count, hour) => (
												<div
													key={`${dow}-${hour}`}
													title={`${DOW_SHORT[dow]} ${hour}:00 — ${count}`}
													className="aspect-square min-h-4 rounded-sm"
													style={{
														backgroundColor: heatColor(count, heatMax),
													}}
												/>
											))}
										</Fragment>
									))}
								</div>
							</div>
						</section>

						<section className="rounded-lg border border-border bg-card p-4 xl:col-span-2">
							<h2 className="mb-4 text-sm font-semibold">
								قیف ورود → رزولوشن
							</h2>
							<div className="flex flex-col gap-3">
								{funnelSteps.map((step) => (
									<div key={step.label}>
										<div className="mb-1 flex justify-between text-sm">
											<span>{step.label}</span>
											<span className="text-muted-foreground">
												{step.count.toLocaleString("fa-IR")} ({step.pct}%)
											</span>
										</div>
										<div className="h-2 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-primary transition-all"
												style={{ width: `${step.pct}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						</section>
					</div>
				) : null}
			</div>
		</div>
	);
}
