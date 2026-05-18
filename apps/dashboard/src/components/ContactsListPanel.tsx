"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Contact } from "@/lib/api";
import {
	contactBulkAction,
	exportContactsCsv,
	fetchContacts,
	importContactsRows,
	isContactBannedMeta,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

export function ContactsListPanel({ workspaceId, workspaceRole }: Props) {
	const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
	const [q, setQ] = useState("");
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const [tagInput, setTagInput] = useState("");
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		const rows = await fetchContacts(workspaceId, q.trim() || undefined);
		setContacts(rows);
		setSelected(new Set());
		setLoading(false);
	}, [workspaceId, q]);

	useEffect(() => {
		const t = setTimeout(() => void reload(), 300);
		return () => clearTimeout(t);
	}, [reload]);

	const selectedIds = [...selected];

	function toggle(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAll() {
		if (selected.size === contacts.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(contacts.map((c) => c.id)));
		}
	}

	async function runBulk(
		payload: Parameters<typeof contactBulkAction>[1],
		okMsg: string,
	) {
		setError("");
		const result = await contactBulkAction(workspaceId, payload);
		if (!result) {
			setError("عملیات ناموفق بود.");
			return;
		}
		setMsg(`${okMsg} (${result.processed} مورد)`);
		await reload();
	}

	async function handleAddTags() {
		const tags = tagInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		if (!tags.length || !selectedIds.length) return;
		await runBulk(
			{ action: "add_tags", contact_ids: selectedIds, tags },
			"تگ‌ها اضافه شد",
		);
	}

	async function handleBan() {
		if (!selectedIds.length || !confirm("مخاطبین انتخاب‌شده مسدود شوند؟")) return;
		await runBulk({ action: "ban", contact_ids: selectedIds }, "مسدود شد");
	}

	async function handleUnban() {
		if (!selectedIds.length) return;
		await runBulk({ action: "unban", contact_ids: selectedIds }, "رفع مسدودیت");
	}

	async function handleMerge() {
		if (selectedIds.length < 2) {
			setError("برای ادغام حداقل ۲ مخاطب انتخاب کنید.");
			return;
		}
		const primary = selectedIds[0]!;
		const merge_ids = selectedIds.slice(1);
		if (
			!confirm(
				`مخاطب ${primary.slice(0, 8)}… به‌عنوان اصلی باقی می‌ماند و ${merge_ids.length} مورد ادغام می‌شود.`,
			)
		) {
			return;
		}
		await runBulk({ action: "merge", primary_id: primary, merge_ids }, "ادغام شد");
	}

	async function handleExport() {
		const blob = await exportContactsCsv(
			workspaceId,
			selectedIds.length ? selectedIds : undefined,
		);
		if (!blob) {
			setError("خروجی CSV ناموفق بود.");
			return;
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "contacts-export.csv";
		a.click();
		URL.revokeObjectURL(url);
		setMsg("فایل CSV دانلود شد.");
	}

	function handleImportFile(file: File) {
		Papa.parse<Record<string, string>>(file, {
			header: true,
			skipEmptyLines: true,
			complete: async (parsed) => {
				const rows = parsed.data.map((row) => ({
					full_name: row.full_name || row.name || row.fullName || null,
					email: row.email || null,
					phone: row.phone || null,
					external_id: row.external_id || null,
					tags: (row.tags || "")
						.split(/[|,]/)
						.map((t) => t.trim())
						.filter(Boolean),
				}));
				const result = await importContactsRows(workspaceId, rows);
				if (!result) {
					setError("ورود CSV ناموفق بود.");
					return;
				}
				setMsg(
					`ورود: ${result.created} ایجاد، ${result.skipped} رد شده` +
						(result.errors.length ? ` · ${result.errors.length} خطا` : ""),
				);
				await reload();
			},
			error: () => setError("خواندن فایل CSV ناموفق بود."),
		});
	}

	return (
		<div className="flex h-full flex-col">
			<header className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">مخاطبین</h1>
				<p className="text-sm text-muted-foreground">
					جستجو، انتخاب چندتایی، تگ، export، ban و import CSV
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<Input
						className="max-w-md flex-1"
						placeholder="نام، ایمیل یا تلفن…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
					{canEdit && (
						<>
							<input
								ref={fileRef}
								type="file"
								accept=".csv,text/csv"
								className="hidden"
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (f) handleImportFile(f);
									e.target.value = "";
								}}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => fileRef.current?.click()}
							>
								ورود CSV
							</Button>
						</>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void handleExport()}
					>
						خروجی CSV
						{selectedIds.length ? ` (${selectedIds.length})` : ""}
					</Button>
				</div>
			</header>

			{canEdit && selectedIds.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-6 py-3">
					<span className="text-sm font-medium">{selectedIds.length} انتخاب</span>
					<Input
						className="h-8 max-w-[180px] text-sm"
						placeholder="تگ‌ها (با کاما)"
						value={tagInput}
						onChange={(e) => setTagInput(e.target.value)}
					/>
					<Button type="button" size="sm" onClick={() => void handleAddTags()}>
						افزودن تگ
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => void handleBan()}
					>
						مسدود
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => void handleUnban()}
					>
						رفع مسدودیت
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => void handleMerge()}
					>
						ادغام
					</Button>
				</div>
			)}

			{msg && <p className="px-6 pt-2 text-sm text-green-600">{msg}</p>}
			{error && <p className="px-6 pt-2 text-sm text-destructive">{error}</p>}

			<div className="min-h-0 flex-1 overflow-y-auto p-6">
				{loading ? (
					<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
				) : contacts.length === 0 ? (
					<p className="text-sm text-muted-foreground">مخاطبی یافت نشد.</p>
				) : (
					<ul className="divide-y divide-border rounded-lg border border-border bg-card">
						<li className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
							{canEdit && (
								<input
									type="checkbox"
									checked={
										contacts.length > 0 && selected.size === contacts.length
									}
									onChange={toggleAll}
								/>
							)}
							<span className="flex-1">مخاطب</span>
							<span>آخرین بازدید</span>
						</li>
						{contacts.map((c) => (
							<li key={c.id} className="flex items-center gap-3">
								{canEdit && (
									<input
										type="checkbox"
										className="ms-4"
										checked={selected.has(c.id)}
										onChange={() => toggle(c.id)}
									/>
								)}
								<Link
									href={`/contacts/${c.id}`}
									className={cn(
										"flex min-w-0 flex-1 items-center justify-between gap-4 py-3 pe-4 transition-colors hover:bg-muted/50",
										!canEdit && "ps-4",
									)}
								>
									<div className="min-w-0">
										<p className="truncate font-medium">
											{c.fullName || c.email || c.phone || c.id.slice(0, 8)}
											{isContactBannedMeta(c.metadata) && (
												<span className="ms-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
													مسدود
												</span>
											)}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{c.email}
											{c.email && c.phone ? " · " : ""}
											{c.phone}
											{c.tags.length > 0 && (
												<span className="ms-1">
													· {c.tags.slice(0, 3).join(", ")}
												</span>
											)}
										</p>
									</div>
									<span className="shrink-0 text-xs text-muted-foreground">
										{new Date(c.lastSeenAt).toLocaleDateString("fa-IR")}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
