"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationDetail, WorkspaceMember } from "@/lib/api";
import {
	addConversationNote,
	addConversationTags,
	getAiSuggestedTags,
	requestConversationAiTags,
	archiveConversation,
	assignConversation,
	banConversationContact,
	banConversationIp,
	fetchConversationDetail,
	fetchWorkspaceMembers,
	isContactBanned,
	refreshConversationSummary,
	unarchiveConversation,
	unbanConversationContact,
	updateConversationPriority,
	updateConversationStatus,
} from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	conversationId: string;
	userId: string;
	workspaceRole: string;
	onUpdated?: (patch: Partial<ConversationDetail>) => void;
}

const STATUS_OPTIONS = [
	{ value: "open", label: "باز" },
	{ value: "pending", label: "در انتظار" },
	{ value: "resolved", label: "حل‌شده" },
	{ value: "closed", label: "بسته" },
];

const PRIORITY_OPTIONS = [
	{ value: 0, label: "عادی" },
	{ value: 1, label: "متوسط" },
	{ value: 2, label: "بالا" },
	{ value: 3, label: "فوری" },
];

export function ConversationToolbar({
	workspaceId,
	conversationId,
	userId,
	workspaceRole,
	onUpdated,
}: Props) {
	const canBan =
		workspaceRole === "owner" || workspaceRole === "admin";
	const [detail, setDetail] = useState<ConversationDetail | null>(null);
	const [members, setMembers] = useState<WorkspaceMember[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [aiTagLoading, setAiTagLoading] = useState(false);
	const [noteInput, setNoteInput] = useState("");
	const [notesOpen, setNotesOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [summaryLoading, setSummaryLoading] = useState(false);

	const reload = useCallback(async () => {
		const d = await fetchConversationDetail(workspaceId, conversationId);
		if (d) setDetail(d);
		return d;
	}, [workspaceId, conversationId]);

	useEffect(() => {
		void (async () => {
			const d = await reload();
			if (d && !d.summary && !d.needsHuman) {
				setSummaryLoading(true);
				const { summary } = await refreshConversationSummary(
					workspaceId,
					conversationId,
				);
				setSummaryLoading(false);
				if (summary) {
					setDetail((prev) => (prev ? { ...prev, summary } : prev));
					onUpdated?.({ summary });
				}
			}
		})();
		fetchWorkspaceMembers(workspaceId).then(setMembers);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- load once per conversation
	}, [workspaceId, conversationId]);

	async function run<T>(action: () => Promise<T>, patch?: Partial<ConversationDetail>) {
		setSaving(true);
		try {
			const result = await action();
			if (patch) {
				setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
				onUpdated?.(patch);
			}
			return result;
		} finally {
			setSaving(false);
		}
	}

	if (!detail) {
		return (
			<div className="border-b border-border bg-card px-4 py-3 text-sm text-muted-foreground">
				در حال بارگذاری مکالمه…
			</div>
		);
	}

	const meta =
		detail.metadata && typeof detail.metadata === "object"
			? (detail.metadata as { archivedAt?: string })
			: null;
	const isArchived = Boolean(meta?.archivedAt);
	const contactBannedFlag = isContactBanned(detail.contact?.metadata);
	const visitorIp =
		typeof detail.visitor?.ip === "string" ? detail.visitor.ip : null;

	const visitorLabel =
		detail.contact?.fullName ?? `Visitor · ${detail.id.slice(0, 8)}`;

	return (
		<div className="shrink-0 border-b border-border bg-card">
			{!detail.needsHuman && (detail.summary || summaryLoading) && (
				<div className="border-b border-border bg-muted/30 px-4 py-2 text-sm">
					<div className="mb-1 flex items-center justify-between gap-2">
						<span className="text-xs font-medium text-muted-foreground">
							خلاصه مکالمه
						</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 text-xs"
							disabled={summaryLoading}
							onClick={() => {
								setSummaryLoading(true);
								void refreshConversationSummary(
									workspaceId,
									conversationId,
								).then(({ summary }) => {
									setSummaryLoading(false);
									if (summary) {
										setDetail((prev) =>
											prev ? { ...prev, summary } : prev,
										);
										onUpdated?.({ summary });
									}
								});
							}}
						>
							{summaryLoading ? "…" : "بروزرسانی"}
						</Button>
					</div>
					<p className="whitespace-pre-wrap text-foreground leading-relaxed">
						{summaryLoading && !detail.summary
							? "در حال تهیه خلاصه…"
							: detail.summary}
					</p>
				</div>
			)}
			<div className="flex flex-wrap items-center gap-2 px-4 py-3">
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold">{visitorLabel}</p>
					<p className="text-xs text-muted-foreground">
						{detail.channel === "widget" ? "ویجت" : detail.channel}
						{detail.subject ? ` · ${detail.subject}` : ""}
						{contactBannedFlag ? " · مسدود" : ""}
					</p>
				</div>
				<select
					disabled={saving}
					value={detail.status}
					onChange={(e) =>
						void run(
							() => updateConversationStatus(workspaceId, conversationId, e.target.value),
							{ status: e.target.value },
						)
					}
					className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					title="وضعیت"
				>
					{STATUS_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				<select
					disabled={saving}
					value={detail.priority ?? 0}
					onChange={(e) =>
						void run(
							() =>
								updateConversationPriority(
									workspaceId,
									conversationId,
									Number(e.target.value),
								),
							{ priority: Number(e.target.value) },
						)
					}
					className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					title="اولویت"
				>
					{PRIORITY_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				<select
					disabled={saving}
					value={detail.assignedAgentId ?? ""}
					onChange={(e) =>
						void run(
							() =>
								assignConversation(
									workspaceId,
									conversationId,
									e.target.value || null,
								),
							{ assignedAgentId: e.target.value || null },
						)
					}
					className="h-8 max-w-[140px] rounded-md border border-input bg-background px-2 text-xs"
					title="اپراتور"
				>
					<option value="">بدون تخصیص</option>
					{members.map((m) => (
						<option key={m.userId} value={m.userId}>
							{m.fullName || m.email || m.userId.slice(0, 8)}
							{m.userId === userId ? " (شما)" : ""}
						</option>
					))}
				</select>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={saving}
					onClick={() =>
						void run(async () => {
							if (isArchived) {
								await unarchiveConversation(workspaceId, conversationId);
							} else {
								await archiveConversation(workspaceId, conversationId);
							}
							await reload();
						})
					}
				>
					{isArchived ? "بازگردانی از آرشیو" : "آرشیو"}
				</Button>
				{canBan && (
					<Button
						type="button"
						variant={contactBannedFlag ? "outline" : "destructive"}
						size="sm"
						disabled={saving}
						onClick={() => {
							if (contactBannedFlag) {
								if (
									!window.confirm(
										"مسدودیت این بازدیدکننده برداشته شود؟",
									)
								) {
									return;
								}
								void run(async () => {
									await unbanConversationContact(
										workspaceId,
										conversationId,
									);
									await reload();
								});
								return;
							}
							if (
								!window.confirm(
									"این بازدیدکننده مسدود شود؟ دیگر نمی‌تواند چت جدید شروع کند.",
								)
							) {
								return;
							}
							void run(async () => {
								await banConversationContact(
									workspaceId,
									conversationId,
								);
								await reload();
							});
						}}
					>
						{contactBannedFlag ? "رفع مسدودیت" : "مسدود کردن"}
					</Button>
				)}
				{canBan && visitorIp && detail.channel === "widget" && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={saving}
						onClick={() => {
							if (
								!window.confirm(
									`IP ${visitorIp} به لیست مسدود اضافه شود؟ هر بازدیدکننده با این IP نمی‌تواند چت کند.`,
								)
							) {
								return;
							}
							void run(async () => {
								const result = await banConversationIp(
									workspaceId,
									conversationId,
								);
								if (!result.ok) {
									window.alert(result.error ?? "مسدود کردن IP ناموفق بود.");
									return;
								}
								window.alert(`IP ${result.ip ?? visitorIp} مسدود شد.`);
							});
						}}
					>
						مسدود IP
					</Button>
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setNotesOpen((v) => !v)}
				>
					یادداشت‌ها ({detail.notes?.length ?? 0})
				</Button>
			</div>
			<div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
				{(detail.tags ?? []).map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
					>
						{tag}
					</span>
				))}
				{getAiSuggestedTags(detail.metadata)
					.filter((t) => !(detail.tags ?? []).includes(t))
					.map((tag) => (
						<button
							key={`ai-${tag}`}
							type="button"
							disabled={saving}
							className="rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-xs text-primary hover:bg-primary/5"
							title="پیشنهاد AI — کلیک برای افزودن"
							onClick={() => {
								void run(async () => {
									await addConversationTags(workspaceId, conversationId, [
										tag,
									]);
									const tags = [...(detail.tags ?? []), tag];
									setDetail((prev) => (prev ? { ...prev, tags } : prev));
									onUpdated?.({ tags });
								});
							}}
						>
							+ {tag}
						</button>
					))}
				<Button
					type="button"
					size="sm"
					variant="ghost"
					className="h-7 text-xs"
					disabled={aiTagLoading || saving}
					onClick={() => {
						void run(async () => {
							setAiTagLoading(true);
							const result = await requestConversationAiTags(
								workspaceId,
								conversationId,
								{ force: true },
							);
							setAiTagLoading(false);
							if (!result?.ok) {
								window.alert("تگ‌گذاری AI ناموفق بود. ai-service را بررسی کنید.");
								return;
							}
							const d = await reload();
							if (d) {
								onUpdated?.({ tags: d.tags, metadata: d.metadata });
							}
						});
					}}
				>
					{aiTagLoading ? "AI…" : "تگ AI"}
				</Button>
				<div className="flex flex-1 gap-1">
					<Input
						value={tagInput}
						onChange={(e) => setTagInput(e.target.value)}
						placeholder="تگ جدید…"
						className="h-8 flex-1 text-xs"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								const t = tagInput.trim();
								if (!t) return;
								void run(async () => {
									await addConversationTags(workspaceId, conversationId, [t]);
									const tags = [...(detail.tags ?? []), t];
									setDetail((prev) => (prev ? { ...prev, tags } : prev));
									setTagInput("");
									onUpdated?.({ tags });
								});
							}
						}}
					/>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={!tagInput.trim() || saving}
						onClick={() => {
							const t = tagInput.trim();
							if (!t) return;
							void run(async () => {
								await addConversationTags(workspaceId, conversationId, [t]);
								const tags = [...(detail.tags ?? []), t];
								setDetail((prev) => (prev ? { ...prev, tags } : prev));
								setTagInput("");
								onUpdated?.({ tags });
							});
						}}
					>
						+
					</Button>
				</div>
			</div>
			{notesOpen && (
				<div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3">
					{(detail.notes ?? []).length === 0 && (
						<p className="text-xs text-muted-foreground">یادداشتی نیست.</p>
					)}
					{(detail.notes ?? []).map((note) => (
						<div key={note.id} className="rounded-md border border-border bg-card p-2 text-xs">
							<p className="whitespace-pre-wrap">{note.body}</p>
							<p className="mt-1 text-muted-foreground">
								{note.author?.fullName ?? note.author?.email ?? "اپراتور"} ·{" "}
								{new Date(note.createdAt).toLocaleString("fa-IR")}
							</p>
						</div>
					))}
					<div className="flex gap-2">
						<Input
							value={noteInput}
							onChange={(e) => setNoteInput(e.target.value)}
							placeholder="یادداشت داخلی (فقط تیم)…"
							className="h-8 flex-1 text-xs"
						/>
						<Button
							type="button"
							size="sm"
							disabled={!noteInput.trim() || saving}
							onClick={() => {
								const body = noteInput.trim();
								if (!body) return;
								void run(async () => {
									const note = await addConversationNote(
										workspaceId,
										conversationId,
										body,
									);
									if (note) {
										const notes = [note, ...(detail.notes ?? [])];
										setDetail((prev) => (prev ? { ...prev, notes } : prev));
										setNoteInput("");
									}
								});
							}}
						>
							افزودن
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
