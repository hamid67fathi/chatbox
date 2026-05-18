"use client";

import { Button } from "@/components/ui/button";
import { downloadAuditLogsCsv, fetchAuditLogs, type AuditLogRow } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
}

const ACTION_LABELS: Record<string, string> = {
	"auth.login": "ورود",
	"auth.logout": "خروج",
	"auth.login_google": "ورود Google",
	"auth.2fa_enable": "فعال‌سازی 2FA",
	"auth.2fa_disable": "غیرفعال‌سازی 2FA",
	"security.require_2fa_update": "الزام 2FA workspace",
	"workspace.update": "به‌روزرسانی ورک‌اسپیس",
	"widget_config.update": "تنظیمات ویجت",
	"security.banned_ips_update": "IP مسدود",
	"security.dashboard_ip_whitelist_update": "لیست مجاز IP داشبورد",
	"notification.preferences_update": "تنظیمات اعلان",
	"api_token.create": "ایجاد API token",
	"api_token.revoke": "لغو API token",
	"data.export_contacts": "خروجی مخاطبین",
	"data.export_conversations": "خروجی مکالمات",
	"data.export_agents": "خروجی اپراتورها",
	"data.export_overview": "خروجی نمای کلی",
	"audit.export": "خروجی audit",
};

function defaultFrom(): string {
	const d = new Date();
	d.setDate(d.getDate() - 30);
	return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
	return new Date().toISOString().slice(0, 10);
}

export function AuditLogPanel({ workspaceId }: Props) {
	const [from, setFrom] = useState(defaultFrom);
	const [to, setTo] = useState(defaultTo);
	const [action, setAction] = useState("");
	const [rows, setRows] = useState<AuditLogRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [msg, setMsg] = useState("");

	const reload = useCallback(async () => {
		setLoading(true);
		const fromIso = new Date(`${from}T00:00:00`).toISOString();
		const toIso = new Date(`${to}T23:59:59`).toISOString();
		const result = await fetchAuditLogs(workspaceId, {
			from: fromIso,
			to: toIso,
			action: action || undefined,
			limit: 100,
		});
		setRows(result.rows);
		setTotal(result.total);
		setLoading(false);
	}, [workspaceId, from, to, action]);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function handleExport() {
		const fromIso = new Date(`${from}T00:00:00`).toISOString();
		const toIso = new Date(`${to}T23:59:59`).toISOString();
		const ok = await downloadAuditLogsCsv(
			workspaceId,
			fromIso,
			toIso,
			action || undefined,
		);
		setMsg(ok ? "فایل CSV دانلود شد." : "خروجی ناموفق بود.");
	}

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-4">
			<p className="text-sm text-muted-foreground">
				ثبت اقدامات حساس (ورود، تنظیمات، export). نگهداری حداکثر ۱ سال.
			</p>

			<div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
				<label className="block text-sm">
					<span className="text-muted-foreground">از تاریخ</span>
					<input
						type="date"
						className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
					/>
				</label>
				<label className="block text-sm">
					<span className="text-muted-foreground">تا تاریخ</span>
					<input
						type="date"
						className="mt-1 block rounded-md border border-input bg-background px-3 py-2"
						value={to}
						onChange={(e) => setTo(e.target.value)}
					/>
				</label>
				<label className="block min-w-[12rem] flex-1 text-sm">
					<span className="text-muted-foreground">اقدام (فیلتر)</span>
					<input
						className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
						placeholder="مثلاً auth.login"
						value={action}
						onChange={(e) => setAction(e.target.value)}
					/>
				</label>
				<Button type="button" variant="outline" onClick={() => void reload()}>
					جستجو
				</Button>
				<Button type="button" onClick={() => void handleExport()}>
					خروجی CSV
				</Button>
			</div>

			{loading ? (
				<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
			) : rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">رویدادی یافت نشد.</p>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b bg-muted/40 text-muted-foreground">
								<th className="p-2 text-start">زمان</th>
								<th className="p-2 text-start">اقدام</th>
								<th className="p-2 text-start">کاربر</th>
								<th className="p-2 text-start">هدف</th>
								<th className="p-2 text-start">IP</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id} className="border-b border-border/50">
									<td className="whitespace-nowrap p-2">
										{new Date(r.created_at).toLocaleString("fa-IR")}
									</td>
									<td className="p-2 font-mono">
										{ACTION_LABELS[r.action] ?? r.action}
									</td>
									<td className="p-2">
										{r.actor_name || r.actor_email || "—"}
									</td>
									<td className="p-2 font-mono text-muted-foreground">
										{r.target_type}
										{r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ""}
									</td>
									<td className="p-2">{r.ip_address ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
					<p className="border-t p-2 text-xs text-muted-foreground">
						نمایش {rows.length} از {total} رویداد
					</p>
				</div>
			)}

			{msg && <p className="text-sm text-primary">{msg}</p>}
		</div>
	);
}
