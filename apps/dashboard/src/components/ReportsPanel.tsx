"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	type ConversationReportFilters,
	type ConversationReportRow,
	downloadConversationReportCsv,
	fetchConversationReport,
	fetchCsatSummary,
	fetchSlaViolations,
	type CsatSummary,
	fetchWorkspaceMembers,
	type SlaViolationRow,
} from "@/lib/api";
import { Download, FileBarChart, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Props {
	workspaceId: string;
}

const STATUS_OPTIONS = [
	{ value: "", label: "همه وضعیت‌ها" },
	{ value: "open", label: "باز" },
	{ value: "pending", label: "در انتظار" },
	{ value: "resolved", label: "حل‌شده" },
	{ value: "closed", label: "بسته" },
];

const CHANNEL_OPTIONS = [
	{ value: "", label: "همه کانال‌ها" },
	{ value: "widget", label: "ویجت" },
];

const ARCHIVED_OPTIONS = [
	{ value: "all", label: "همه (فعال + آرشیو)" },
	{ value: "false", label: "غیر آرشیو" },
	{ value: "true", label: "فقط آرشیو" },
];

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

function contactLabel(row: ConversationReportRow): string {
	const c = row.contact;
	const name = c?.full_name ?? c?.fullName;
	if (name) return name;
	if (c?.email) return c.email;
	if (c?.phone) return c.phone;
	return "—";
}

function agentLabel(row: ConversationReportRow): string {
	const a = row.assigned_agent;
	return a?.email ?? a?.full_name ?? a?.fullName ?? "—";
}

export function ReportsPanel({ workspaceId }: Props) {
	const initial = useMemo(() => defaultRange(), []);
	const [fromDate, setFromDate] = useState(initial.from);
	const [toDate, setToDate] = useState(initial.to);
	const [status, setStatus] = useState("");
	const [channel, setChannel] = useState("");
	const [archived, setArchived] = useState<"true" | "false" | "all">("all");
	const [assignedTo, setAssignedTo] = useState("");
	const [tag, setTag] = useState("");
	const [q, setQ] = useState("");
	const [slaRows, setSlaRows] = useState<SlaViolationRow[]>([]);
	const [slaLoading, setSlaLoading] = useState(false);
	const [csatSummary, setCsatSummary] = useState<CsatSummary | null>(null);
	const [csatLoading, setCsatLoading] = useState(false);

	const [rows, setRows] = useState<ConversationReportRow[]>([]);
	const [total, setTotal] = useState(0);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [agents, setAgents] = useState<{ id: string; email: string; full_name: string | null }[]>([]);

	const filters = useMemo((): ConversationReportFilters => {
		const f: ConversationReportFilters = {
			from: dayStartIso(fromDate),
			to: dayEndIso(toDate),
			limit: 50,
			offset,
			archived,
		};
		if (status) f.status = status;
		if (channel) f.channel = channel;
		if (assignedTo) f.assignedTo = assignedTo;
		if (tag.trim()) f.tag = tag.trim();
		if (q.trim()) f.q = q.trim();
		return f;
	}, [fromDate, toDate, status, channel, archived, assignedTo, tag, q, offset]);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const result = await fetchConversationReport(workspaceId, filters);
		setRows((prev) =>
			filters.offset && filters.offset > 0
				? [...prev, ...result.data]
				: result.data,
		);
		setTotal(result.total);
		setHasMore(result.hasMore);
		if (result.error) setError(result.error);
		setLoading(false);
	}, [workspaceId, filters]);

	useEffect(() => {
		void fetchWorkspaceMembers(workspaceId).then((members) => {
			setAgents(
				members.map((m) => ({
					id: m.userId,
					email: m.email ?? "",
					full_name: m.fullName,
				})),
			);
		});
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	const loadSla = useCallback(async () => {
		setSlaLoading(true);
		const data = await fetchSlaViolations(
			workspaceId,
			dayStartIso(fromDate),
			dayEndIso(toDate),
		);
		setSlaRows(data);
		setSlaLoading(false);
	}, [workspaceId, fromDate, toDate]);

	const loadCsat = useCallback(async () => {
		setCsatLoading(true);
		const data = await fetchCsatSummary(
			workspaceId,
			dayStartIso(fromDate),
			dayEndIso(toDate),
		);
		setCsatSummary(data);
		setCsatLoading(false);
	}, [workspaceId, fromDate, toDate]);

	function applyFilters(e: React.FormEvent) {
		e.preventDefault();
		setOffset(0);
		setNotice(null);
		void loadSla();
		void loadCsat();
	}

	useEffect(() => {
		if (offset === 0) return;
		void load();
	}, [offset, load]);

	async function handleSearch() {
		setOffset(0);
		setNotice(null);
		await load();
	}

	async function handleExport() {
		setExporting(true);
		setError(null);
		setNotice(null);
		const result = await downloadConversationReportCsv(workspaceId, {
			...filters,
			offset: undefined,
			limit: undefined,
		});
		setExporting(false);
		if (!result.ok) {
			setError(result.error ?? "خروجی CSV ناموفق بود.");
			return;
		}
		if (result.truncated) {
			setNotice("خروجی به ۵۰۰۰ ردیف اول محدود شد؛ بازه را کوچک‌تر کنید.");
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<FileBarChart className="h-5 w-5 text-primary" />
							<h1 className="text-lg font-semibold">گزارش گفتگوها</h1>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							فیلتر بر اساس بازه تاریخ، وضعیت، کانال و جستجو در متن پیام‌ها
						</p>
					</div>
					<div className="flex flex-wrap gap-3 text-sm">
						<Link
							href="/reports/overview"
							className="text-primary hover:underline"
						>
							نمای کلی
						</Link>
						<Link
							href="/reports/agents"
							className="text-primary hover:underline"
						>
							عملکرد اپراتورها
						</Link>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<form
					onSubmit={applyFilters}
					className="mb-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2 lg:grid-cols-3"
				>
					<label className="flex flex-col gap-1 text-sm font-medium">
						از تاریخ
						<Input
							type="date"
							value={fromDate}
							onChange={(e) => setFromDate(e.target.value)}
							dir="ltr"
							required
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						تا تاریخ
						<Input
							type="date"
							value={toDate}
							onChange={(e) => setToDate(e.target.value)}
							dir="ltr"
							required
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						وضعیت
						<select
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-2 text-sm"
						>
							{STATUS_OPTIONS.map((o) => (
								<option key={o.value || "all"} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						کانال
						<select
							value={channel}
							onChange={(e) => setChannel(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-2 text-sm"
						>
							{CHANNEL_OPTIONS.map((o) => (
								<option key={o.value || "all"} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						آرشیو
						<select
							value={archived}
							onChange={(e) =>
								setArchived(e.target.value as "true" | "false" | "all")
							}
							className="h-9 rounded-md border border-input bg-background px-2 text-sm"
						>
							{ARCHIVED_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						اپراتور
						<select
							value={assignedTo}
							onChange={(e) => setAssignedTo(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-2 text-sm"
						>
							<option value="">همه</option>
							{agents.map((a) => (
								<option key={a.id} value={a.id}>
									{a.full_name ?? a.email}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						برچسب
						<Input
							value={tag}
							onChange={(e) => setTag(e.target.value)}
							placeholder="نام برچسب"
							dir="ltr"
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
						جستجو (موضوع، مخاطب، متن پیام)
						<div className="flex gap-2">
							<Input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="کلمه کلیدی…"
							/>
						</div>
					</label>
					<div className="flex flex-wrap items-end gap-2 md:col-span-3">
						<Button type="button" onClick={() => void handleSearch()}>
							<Search className="me-2 h-4 w-4" />
							اعمال فیلتر
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={exporting}
							onClick={() => void handleExport()}
						>
							{exporting ? (
								<Loader2 className="me-2 h-4 w-4 animate-spin" />
							) : (
								<Download className="me-2 h-4 w-4" />
							)}
							خروجی CSV
						</Button>
					</div>
				</form>

				{error && <p className="mb-3 text-sm text-destructive">{error}</p>}
				{notice && <p className="mb-3 text-sm text-primary">{notice}</p>}

				<p className="mb-3 text-sm text-muted-foreground">
					{loading ? "در حال بارگذاری…" : `${total.toLocaleString("fa-IR")} گفتگو`}
				</p>

				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full min-w-[720px] text-sm">
						<thead className="bg-muted/50 text-muted-foreground">
							<tr>
								<th className="px-3 py-2 text-start font-medium">مخاطب</th>
								<th className="px-3 py-2 text-start font-medium">وضعیت</th>
								<th className="px-3 py-2 text-start font-medium">کانال</th>
								<th className="px-3 py-2 text-start font-medium">اپراتور</th>
								<th className="px-3 py-2 text-start font-medium">پیام‌ها</th>
								<th className="px-3 py-2 text-start font-medium">آخرین فعالیت</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && !loading ? (
								<tr>
									<td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
										موردی یافت نشد.
									</td>
								</tr>
							) : (
								rows.map((row) => (
									<tr key={row.id} className="border-t border-border">
										<td className="px-3 py-2">
											<p className="font-medium">{contactLabel(row)}</p>
											{row.subject && (
												<p className="text-xs text-muted-foreground">{row.subject}</p>
											)}
										</td>
										<td className="px-3 py-2">{row.status}</td>
										<td className="px-3 py-2">{row.channel}</td>
										<td className="px-3 py-2">{agentLabel(row)}</td>
										<td className="px-3 py-2" dir="ltr">
											{row.message_count}
										</td>
										<td className="px-3 py-2 text-xs" dir="ltr">
											{row.last_message_at
												? new Date(row.last_message_at).toLocaleString("fa-IR")
												: new Date(row.created_at).toLocaleString("fa-IR")}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{hasMore && (
					<div className="mt-4 flex justify-center">
						<Button
							type="button"
							variant="outline"
							disabled={loading}
							onClick={() => setOffset((o) => o + 50)}
						>
							بارگذاری بیشتر
						</Button>
					</div>
				)}

				<div className="mt-10 border-t border-border pt-6">
					<h2 className="mb-2 text-base font-semibold">نقض SLA</h2>
					<p className="mb-3 text-sm text-muted-foreground">
						مکالماتی که در بازهٔ بالا به زمان اولین پاسخ یا حل، نرسیده‌اند.
					</p>
					{slaLoading ? (
						<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
					) : slaRows.length === 0 ? (
						<p className="text-sm text-muted-foreground">نقضی ثبت نشده.</p>
					) : (
						<div className="overflow-x-auto rounded-lg border border-border">
							<table className="w-full min-w-[520px] text-sm">
								<thead className="bg-muted/50 text-muted-foreground">
									<tr>
										<th className="px-3 py-2 text-start">مکالمه</th>
										<th className="px-3 py-2 text-start">کانال</th>
										<th className="px-3 py-2 text-start">اولین پاسخ</th>
										<th className="px-3 py-2 text-start">حل</th>
									</tr>
								</thead>
								<tbody>
									{slaRows.map((row) => (
										<tr key={row.conversation_id} className="border-t border-border">
											<td className="px-3 py-2 font-mono text-xs" dir="ltr">
												{row.conversation_id.slice(0, 8)}
											</td>
											<td className="px-3 py-2">{row.channel}</td>
											<td className="px-3 py-2">
												{row.first_response_breached ? "نقض" : "—"}
											</td>
											<td className="px-3 py-2">
												{row.resolution_breached ? "نقض" : "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				<div className="mt-10 border-t border-border pt-6">
					<h2 className="mb-2 text-base font-semibold">خلاصه CSAT</h2>
					{csatLoading ? (
						<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
					) : !csatSummary?.enabled ? (
						<p className="text-sm text-muted-foreground">CSAT غیرفعال است.</p>
					) : (
						<>
							<p className="mb-3 text-sm">
								میانگین:{" "}
								<span className="font-semibold">
									{csatSummary.average_score ?? "—"}
								</span>{" "}
								از ۵ ({csatSummary.total_responses.toLocaleString("fa-IR")}{" "}
								پاسخ)
							</p>
							{csatSummary.by_agent.length > 0 && (
								<div className="overflow-x-auto rounded-lg border border-border">
									<table className="w-full min-w-[400px] text-sm">
										<thead className="bg-muted/50 text-muted-foreground">
											<tr>
												<th className="px-3 py-2 text-start">اپراتور</th>
												<th className="px-3 py-2 text-start">تعداد</th>
												<th className="px-3 py-2 text-start">میانگین</th>
											</tr>
										</thead>
										<tbody>
											{csatSummary.by_agent.map((a) => (
												<tr
													key={a.agent_id ?? "none"}
													className="border-t border-border"
												>
													<td className="px-3 py-2">
														{a.agent_name ?? "بدون assign"}
													</td>
													<td className="px-3 py-2">{a.count}</td>
													<td className="px-3 py-2">{a.average_score}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
