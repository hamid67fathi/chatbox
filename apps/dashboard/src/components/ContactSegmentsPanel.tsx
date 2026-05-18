"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContactSegment, SegmentFilters } from "@/lib/api";
import {
	createContactSegment,
	deleteContactSegment,
	fetchContactSegments,
	previewContactSegment,
	updateContactSegment,
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

function emptyFilters(): SegmentFilters {
	return { channels: [], tags: [], tag_mode: "any" };
}

export function ContactSegmentsPanel({ workspaceId, workspaceRole }: Props) {
	const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
	const [segments, setSegments] = useState<ContactSegment[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState({
		name: "",
		description: "",
		filters: emptyFilters(),
	});
	const [tagInput, setTagInput] = useState("");
	const [previewCount, setPreviewCount] = useState<number | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");

	const reload = useCallback(async () => {
		const list = await fetchContactSegments(workspaceId);
		setSegments(list);
		setSelectedId((prev) => prev ?? list[0]?.id ?? null);
	}, [workspaceId]);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		const seg = segments.find((s) => s.id === selectedId);
		if (seg) {
			setDraft({
				name: seg.name,
				description: seg.description ?? "",
				filters: {
					channels: seg.filters?.channels ?? [],
					tags: seg.filters?.tags ?? [],
					tag_mode: seg.filters?.tag_mode ?? "any",
					min_conversations: seg.filters?.min_conversations,
					max_conversations: seg.filters?.max_conversations,
					last_seen_after: seg.filters?.last_seen_after,
					last_seen_before: seg.filters?.last_seen_before,
				},
			});
			setTagInput((seg.filters?.tags ?? []).join(", "));
		}
	}, [selectedId, segments]);

	async function runPreview(filters: SegmentFilters) {
		if (!selectedId) return;
		setPreviewLoading(true);
		const data = await previewContactSegment(workspaceId, selectedId, filters);
		setPreviewCount(data?.count ?? 0);
		setPreviewLoading(false);
	}

	useEffect(() => {
		if (!selectedId) return;
		const t = setTimeout(() => {
			void runPreview(draft.filters);
		}, 400);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedId, draft.filters]);

	async function handleCreate() {
		const row = await createContactSegment(workspaceId, {
			name: "بخش جدید",
			filters: { channels: ["widget"] },
		});
		if (!row) {
			setError("ایجاد بخش ناموفق بود.");
			return;
		}
		setSegments((prev) => [...prev, row]);
		setSelectedId(row.id);
		setMsg("بخش ایجاد شد.");
	}

	async function handleSave() {
		if (!selectedId) return;
		const tags = tagInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		const filters: SegmentFilters = { ...draft.filters, tags };
		const row = await updateContactSegment(workspaceId, selectedId, {
			name: draft.name,
			description: draft.description,
			filters,
		});
		if (!row) {
			setError("ذخیره ناموفق بود.");
			return;
		}
		setSegments((prev) => prev.map((s) => (s.id === row.id ? row : s)));
		setMsg("ذخیره شد.");
	}

	async function handleDelete() {
		if (!selectedId || !canEdit) return;
		if (!confirm("این بخش حذف شود؟")) return;
		const ok = await deleteContactSegment(workspaceId, selectedId);
		if (!ok) {
			setError("حذف ناموفق بود.");
			return;
		}
		setSegments((prev) => prev.filter((s) => s.id !== selectedId));
		setSelectedId(null);
		setMsg("حذف شد.");
	}

	function toggleChannel(ch: string) {
		setDraft((d) => {
			const channels = d.filters.channels ?? [];
			const next = channels.includes(ch)
				? channels.filter((c) => c !== ch)
				: [...channels, ch];
			return { ...d, filters: { ...d.filters, channels: next } };
		});
	}

	return (
		<div className="flex h-full flex-col">
			<header className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">بخش‌بندی مخاطبان</h1>
				<p className="text-sm text-muted-foreground">
					بخش‌های پویا بر اساس کانال، تگ، تعداد مکالمه و آخرین تعامل — قابل
					استفاده در قوانین مسیریابی
				</p>
			</header>
			<div className="flex min-h-0 flex-1">
				<aside className="w-56 shrink-0 border-e border-border p-3">
					{canEdit && (
						<Button
							type="button"
							size="sm"
							className="mb-3 w-full"
							onClick={() => void handleCreate()}
						>
							بخش جدید
						</Button>
					)}
					<ul className="space-y-1">
						{segments.map((s) => (
							<li key={s.id}>
								<button
									type="button"
									className={cn(
										"w-full rounded-md px-3 py-2 text-start text-sm",
										selectedId === s.id
											? "bg-primary/10 text-primary"
											: "hover:bg-muted",
									)}
									onClick={() => setSelectedId(s.id)}
								>
									{s.name}
								</button>
							</li>
						))}
					</ul>
				</aside>
				<main className="min-w-0 flex-1 overflow-y-auto p-6">
					{!selectedId ? (
						<p className="text-muted-foreground">یک بخش را انتخاب کنید.</p>
					) : (
						<div className="mx-auto max-w-xl space-y-4">
							{msg && <p className="text-sm text-green-600">{msg}</p>}
							{error && <p className="text-sm text-destructive">{error}</p>}
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									نام
								</label>
								<Input
									value={draft.name}
									disabled={!canEdit}
									onChange={(e) =>
										setDraft((d) => ({ ...d, name: e.target.value }))
									}
								/>
							</div>
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									توضیح
								</label>
								<Input
									value={draft.description}
									disabled={!canEdit}
									onChange={(e) =>
										setDraft((d) => ({
											...d,
											description: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<p className="mb-2 text-xs font-medium text-muted-foreground">
									کانال‌ها
								</p>
								<div className="flex flex-wrap gap-2">
									{CHANNELS.map((ch) => (
										<Button
											key={ch.value}
											type="button"
											size="sm"
											variant={
												draft.filters.channels?.includes(ch.value)
													? "default"
													: "outline"
											}
											disabled={!canEdit}
											onClick={() => toggleChannel(ch.value)}
										>
											{ch.label}
										</Button>
									))}
								</div>
							</div>
							<div>
								<label className="text-xs font-medium text-muted-foreground">
									تگ‌ها (با کاما)
								</label>
								<Input
									value={tagInput}
									disabled={!canEdit}
									onChange={(e) => setTagInput(e.target.value)}
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="text-xs font-medium text-muted-foreground">
										حداقل مکالمه
									</label>
									<Input
										type="number"
										min={0}
										disabled={!canEdit}
										value={draft.filters.min_conversations ?? ""}
										onChange={(e) =>
											setDraft((d) => ({
												...d,
												filters: {
													...d.filters,
													min_conversations: e.target.value
														? Number(e.target.value)
														: undefined,
												},
											}))
										}
									/>
								</div>
								<div>
									<label className="text-xs font-medium text-muted-foreground">
										حداکثر مکالمه
									</label>
									<Input
										type="number"
										min={0}
										disabled={!canEdit}
										value={draft.filters.max_conversations ?? ""}
										onChange={(e) =>
											setDraft((d) => ({
												...d,
												filters: {
													...d.filters,
													max_conversations: e.target.value
														? Number(e.target.value)
														: undefined,
												},
											}))
										}
									/>
								</div>
							</div>
							<p className="text-sm text-muted-foreground">
								{previewLoading
									? "در حال شمارش…"
									: previewCount != null
										? `${previewCount} مخاطب در این بخش`
										: ""}
							</p>
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
					)}
				</main>
			</div>
		</div>
	);
}
