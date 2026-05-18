"use client";

import { Button } from "@/components/ui/button";
import type { RoutingActionType, RoutingRule, WorkspaceMember } from "@/lib/api";
import {
	createRoutingRule,
	deleteRoutingRule,
	fetchContactSegments,
	fetchRoutingRules,
	fetchWorkspaceMembers,
	updateRoutingRule,
	type ContactSegment,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

const CHANNELS = [
	{ value: "widget", label: "ویجت" },
	{ value: "telegram", label: "تلگرام" },
	{ value: "email", label: "ایمیل" },
	{ value: "whatsapp", label: "واتساپ" },
];

const ACTION_LABELS: Record<RoutingActionType, string> = {
	assign_agent: "اختصاص به اپراتور",
	round_robin: "چرخشی (Round-robin)",
	enable_ai: "فعال‌سازی AI",
	set_priority: "اولویت بالا",
};

function emptyRule(): Omit<RoutingRule, "id" | "workspaceId" | "createdAt" | "updatedAt"> {
	return {
		name: "قانون جدید",
		enabled: true,
		priority: 100,
		conditions: { channels: ["widget"], keywords: [], keyword_mode: "any" },
		action: { type: "round_robin" },
	};
}

export function RoutingRulesPanel({ workspaceId, workspaceRole }: Props) {
	const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
	const [rules, setRules] = useState<RoutingRule[]>([]);
	const [segments, setSegments] = useState<ContactSegment[]>([]);
	const [members, setMembers] = useState<WorkspaceMember[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState(emptyRule());
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");

	const agents = members.filter(
		(m) => m.status === "active" && m.role !== "viewer",
	);

	const reload = useCallback(async () => {
		const [list, team, segs] = await Promise.all([
			fetchRoutingRules(workspaceId),
			fetchWorkspaceMembers(workspaceId),
			fetchContactSegments(workspaceId),
		]);
		setRules(list);
		setMembers(team);
		setSegments(segs);
		setSelectedId((prev) => prev ?? list[0]?.id ?? null);
	}, [workspaceId]);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		const rule = rules.find((r) => r.id === selectedId);
		if (rule) {
			setDraft({
				name: rule.name,
				enabled: rule.enabled,
				priority: rule.priority,
				conditions: {
					channels: rule.conditions?.channels ?? [],
					keywords: rule.conditions?.keywords ?? [],
					keyword_mode: rule.conditions?.keyword_mode ?? "any",
					segment_id: rule.conditions?.segment_id,
				},
				action: { ...rule.action },
			});
		}
	}, [selectedId, rules]);

	async function handleCreate() {
		const row = await createRoutingRule(workspaceId, {
			name: "قانون جدید",
			priority: 100,
			conditions: { channels: ["widget"] },
			action: { type: "round_robin" },
		});
		if (!row) {
			setError("ایجاد قانون ناموفق بود.");
			return;
		}
		setRules((prev) => [...prev, row]);
		setSelectedId(row.id);
		setMsg("قانون جدید ایجاد شد.");
	}

	async function handleSave() {
		if (!selectedId || !canEdit) return;
		const result = await updateRoutingRule(workspaceId, selectedId, draft);
		if (!result.ok) {
			setError(result.error ?? "خطا");
			return;
		}
		if (result.data) {
			setRules((prev) =>
				prev.map((r) => (r.id === result.data!.id ? result.data! : r)),
			);
		}
		setMsg("ذخیره شد.");
	}

	async function handleDelete() {
		if (!selectedId || !canEdit) return;
		if (!confirm("این قانون حذف شود؟")) return;
		const ok = await deleteRoutingRule(workspaceId, selectedId);
		if (!ok) {
			setError("حذف ناموفق بود.");
			return;
		}
		setRules((prev) => prev.filter((r) => r.id !== selectedId));
		setSelectedId(null);
	}

	function toggleChannel(ch: string) {
		const current = draft.conditions.channels ?? [];
		const next = current.includes(ch)
			? current.filter((c) => c !== ch)
			: [...current, ch];
		setDraft({
			...draft,
			conditions: { ...draft.conditions, channels: next },
		});
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-lg font-semibold">قوانین مسیریابی</h1>
					<p className="text-sm text-muted-foreground">
						اولویت کمتر = اجرای زودتر. مکالمهٔ بدون assign اعمال می‌شود.
					</p>
				</div>
				{canEdit && (
					<Button type="button" onClick={() => void handleCreate()}>
						قانون جدید
					</Button>
				)}
			</div>

			<div className="flex min-h-0 flex-1 gap-4">
				<aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
					{rules.length === 0 ? (
						<p className="p-2 text-xs text-muted-foreground">قانونی تعریف نشده.</p>
					) : (
						rules.map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => setSelectedId(r.id)}
								className={cn(
									"rounded-md px-2 py-2 text-start text-sm transition-colors",
									r.id === selectedId
										? "bg-primary/10 text-primary"
										: "hover:bg-accent",
								)}
							>
								<span className="font-medium">{r.name}</span>
								<span className="mt-0.5 block text-xs text-muted-foreground">
									اولویت {r.priority}
									{r.enabled ? "" : " · غیرفعال"}
								</span>
							</button>
						))
					)}
				</aside>

				{selectedId ? (
					<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<label className="block text-sm">
								<span className="text-muted-foreground">نام</span>
								<input
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
									value={draft.name}
									disabled={!canEdit}
									onChange={(e) =>
										setDraft({ ...draft, name: e.target.value })
									}
								/>
							</label>
							<label className="block text-sm">
								<span className="text-muted-foreground">اولویت (کمتر = زودتر)</span>
								<input
									type="number"
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
									value={draft.priority}
									disabled={!canEdit}
									onChange={(e) =>
										setDraft({
											...draft,
											priority: Number(e.target.value) || 0,
										})
									}
								/>
							</label>
						</div>

						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={draft.enabled}
								disabled={!canEdit}
								onChange={(e) =>
									setDraft({ ...draft, enabled: e.target.checked })
								}
							/>
							فعال
						</label>

						<fieldset className="space-y-2">
							<legend className="text-sm font-medium">کانال</legend>
							<div className="flex flex-wrap gap-2">
								{CHANNELS.map((ch) => (
									<button
										key={ch.value}
										type="button"
										disabled={!canEdit}
										onClick={() => toggleChannel(ch.value)}
										className={cn(
											"rounded-full border px-3 py-1 text-xs",
											(draft.conditions.channels ?? []).includes(ch.value)
												? "border-primary bg-primary/10 text-primary"
												: "border-border text-muted-foreground",
										)}
									>
										{ch.label}
									</button>
								))}
							</div>
						</fieldset>

						<label className="block text-sm">
							<span className="text-muted-foreground">
								کلیدواژه‌ها (با کاما — فقط روی پیام مشتری)
							</span>
							<input
								className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
								disabled={!canEdit}
								value={(draft.conditions.keywords ?? []).join(", ")}
								onChange={(e) =>
									setDraft({
										...draft,
										conditions: {
											...draft.conditions,
											keywords: e.target.value
												.split(",")
												.map((k) => k.trim())
												.filter(Boolean),
										},
									})
								}
							/>
						</label>

						<label className="block text-sm">
							<span className="text-muted-foreground">بخش مخاطب (اختیاری)</span>
							<select
								className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
								disabled={!canEdit}
								value={draft.conditions.segment_id ?? ""}
								onChange={(e) =>
									setDraft({
										...draft,
										conditions: {
											...draft.conditions,
											segment_id: e.target.value || undefined,
										},
									})
								}
							>
								<option value="">— همه مخاطبان —</option>
								{segments.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</select>
						</label>

						<label className="block text-sm">
							<span className="text-muted-foreground">اقدام</span>
							<select
								className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
								disabled={!canEdit}
								value={draft.action.type}
								onChange={(e) =>
									setDraft({
										...draft,
										action: {
											...draft.action,
											type: e.target.value as RoutingActionType,
										},
									})
								}
							>
								{(
									Object.entries(ACTION_LABELS) as [RoutingActionType, string][]
								).map(([k, label]) => (
									<option key={k} value={k}>
										{label}
									</option>
								))}
							</select>
						</label>

						{draft.action.type === "assign_agent" && (
							<label className="block text-sm">
								<span className="text-muted-foreground">اپراتور</span>
								<select
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
									disabled={!canEdit}
									value={draft.action.agent_id ?? ""}
									onChange={(e) =>
										setDraft({
											...draft,
											action: {
												...draft.action,
												agent_id: e.target.value,
											},
										})
									}
								>
									<option value="">انتخاب کنید</option>
									{agents.map((m) => (
										<option key={m.userId} value={m.userId}>
											{m.fullName || m.email || m.userId}
										</option>
									))}
								</select>
							</label>
						)}

						{draft.action.type === "set_priority" && (
							<label className="block text-sm">
								<span className="text-muted-foreground">اولویت (۰–۹)</span>
								<input
									type="number"
									min={0}
									max={9}
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
									disabled={!canEdit}
									value={draft.action.priority ?? 5}
									onChange={(e) =>
										setDraft({
											...draft,
											action: {
												...draft.action,
												priority: Number(e.target.value),
											},
										})
									}
								/>
							</label>
						)}

						{draft.action.type === "round_robin" && (
							<p className="text-xs text-muted-foreground">
								بدون انتخاب اپراتور، بین همهٔ اعضای فعال (owner/admin/agent)
								چرخش انجام می‌شود.
							</p>
						)}

						{canEdit && (
							<div className="flex gap-2">
								<Button type="button" onClick={() => void handleSave()}>
									ذخیره
								</Button>
								<Button
									type="button"
									variant="destructive"
									onClick={() => void handleDelete()}
								>
									حذف
								</Button>
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						قانونی انتخاب کنید یا قانون جدید بسازید.
					</div>
				)}
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}
			{msg && <p className="text-sm text-primary">{msg}</p>}
		</div>
	);
}
