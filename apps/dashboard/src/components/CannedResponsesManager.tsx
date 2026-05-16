"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CannedResponse } from "@/lib/api";
import {
	createCannedResponse,
	deleteCannedResponse,
	fetchCannedResponses,
	updateCannedResponse,
} from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
}

export function CannedResponsesManager({ workspaceId }: Props) {
	const [items, setItems] = useState<CannedResponse[]>([]);
	const [loading, setLoading] = useState(true);
	const [shortcut, setShortcut] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [error, setError] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);

	const reload = useCallback(() => {
		setLoading(true);
		fetchCannedResponses(workspaceId).then((data) => {
			setItems(data);
			setLoading(false);
		});
	}, [workspaceId]);

	useEffect(() => {
		reload();
	}, [reload]);

	function resetForm() {
		setShortcut("");
		setTitle("");
		setBody("");
		setEditingId(null);
		setError("");
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const payload = { shortcut, title, body };
		if (editingId) {
			const updated = await updateCannedResponse(workspaceId, editingId, payload);
			if (!updated) {
				setError("ویرایش ناموفق بود (شاید shortcut تکراری است).");
				return;
			}
		} else {
			const created = await createCannedResponse(workspaceId, payload);
			if (!created) {
				setError("ایجاد ناموفق بود (شاید shortcut تکراری است).");
				return;
			}
		}
		resetForm();
		reload();
	}

	function startEdit(item: CannedResponse) {
		setEditingId(item.id);
		setShortcut(item.shortcut);
		setTitle(item.title);
		setBody(item.body);
		setError("");
	}

	async function handleDelete(id: string) {
		if (!confirm("این پاسخ آماده حذف شود؟")) return;
		const ok = await deleteCannedResponse(workspaceId, id);
		if (!ok) {
			setError("حذف ناموفق بود.");
			return;
		}
		if (editingId === id) resetForm();
		reload();
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">پاسخ‌های آماده</h1>
				<p className="text-sm text-muted-foreground">
					در composer تایپ کنید <code className="rounded bg-muted px-1">/shortcut</code> — مثلاً{" "}
					<code className="rounded bg-muted px-1">/greet</code>
				</p>
			</div>
			<div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:flex-row">
				<form
					onSubmit={handleSubmit}
					className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:max-w-sm"
				>
					<h2 className="text-sm font-semibold">
						{editingId ? "ویرایش" : "پاسخ جدید"}
					</h2>
					{error && <p className="text-xs text-destructive">{error}</p>}
					<label className="flex flex-col gap-1 text-xs font-medium">
						Shortcut
						<Input
							value={shortcut}
							onChange={(e) => setShortcut(e.target.value)}
							placeholder="/greet"
							dir="ltr"
							required
						/>
					</label>
					<label className="flex flex-col gap-1 text-xs font-medium">
						عنوان
						<Input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="خوش‌آمدگویی"
							required
						/>
					</label>
					<label className="flex flex-col gap-1 text-xs font-medium">
						متن (متغیر: {"{{name}}"})
						<textarea
							value={body}
							onChange={(e) => setBody(e.target.value)}
							className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
							placeholder="سلام {{name}} عزیز…"
							required
						/>
					</label>
					<div className="flex gap-2">
						<Button type="submit">{editingId ? "ذخیره" : "افزودن"}</Button>
						{editingId && (
							<Button type="button" variant="outline" onClick={resetForm}>
								انصراف
							</Button>
						)}
					</div>
				</form>
				<div className="min-w-0 flex-1">
					{loading ? (
						<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
					) : items.length === 0 ? (
						<p className="text-sm text-muted-foreground">پاسخ آماده‌ای نیست.</p>
					) : (
						<ul className="space-y-2">
							{items.map((item) => (
								<li
									key={item.id}
									className="rounded-lg border border-border bg-card p-4"
								>
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="font-mono text-sm text-primary">{item.shortcut}</p>
											<p className="font-medium">{item.title}</p>
											<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
												{item.body}
											</p>
											<p className="mt-2 text-xs text-muted-foreground">
												استفاده: {item.usageCount}
											</p>
										</div>
										<div className="flex shrink-0 gap-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => startEdit(item)}
											>
												ویرایش
											</Button>
											<Button
												type="button"
												size="sm"
												variant="destructive"
												onClick={() => handleDelete(item.id)}
											>
												حذف
											</Button>
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
