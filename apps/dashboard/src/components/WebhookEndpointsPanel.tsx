"use client";

import { Button } from "@/components/ui/button";
import type { WebhookEndpoint, WebhookEventType } from "@/lib/api";
import {
	createWebhookEndpoint,
	deleteWebhookEndpoint,
	fetchWebhookDeliveries,
	fetchWebhookEndpoints,
	rotateWebhookSecret,
	updateWebhookEndpoint,
	type WebhookDelivery,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
	{ value: "conversation.created", label: "مکالمه جدید" },
	{ value: "message.created", label: "پیام جدید (مشتری)" },
	{ value: "conversation.resolved", label: "بسته شدن مکالمه" },
];

function emptyDraft() {
	return {
		name: "Webhook جدید",
		url: "",
		enabled: true,
		events: ["conversation.created", "message.created"] as WebhookEventType[],
	};
}

const STATUS_LABELS: Record<string, string> = {
	pending: "در صف",
	delivered: "موفق",
	failed: "ناموفق",
};

export function WebhookEndpointsPanel({ workspaceId, workspaceRole }: Props) {
	const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
	const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState(emptyDraft());
	const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
	const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");

	const reload = useCallback(async () => {
		const list = await fetchWebhookEndpoints(workspaceId);
		setEndpoints(list);
		setSelectedId((prev) => prev ?? list[0]?.id ?? null);
	}, [workspaceId]);

	const reloadDeliveries = useCallback(async () => {
		if (!selectedId) {
			setDeliveries([]);
			return;
		}
		const rows = await fetchWebhookDeliveries(workspaceId, selectedId);
		setDeliveries(rows);
	}, [workspaceId, selectedId]);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		const ep = endpoints.find((e) => e.id === selectedId);
		if (ep) {
			setDraft({
				name: ep.name,
				url: ep.url,
				enabled: ep.enabled,
				events: ep.events?.length
					? ep.events
					: (["conversation.created"] as WebhookEventType[]),
			});
		}
		void reloadDeliveries();
	}, [selectedId, endpoints, reloadDeliveries]);

	async function handleCreate() {
		const url = prompt("آدرس HTTPS webhook را وارد کنید:");
		if (!url?.trim()) return;
		const result = await createWebhookEndpoint(workspaceId, {
			name: "Webhook جدید",
			url: url.trim(),
			events: draft.events,
		});
		if (!result.data) {
			setError(result.error ?? "ایجاد ناموفق بود.");
			return;
		}
		setEndpoints((prev) => [...prev, result.data!]);
		setSelectedId(result.data.id);
		if (result.data.secret) {
			setRevealedSecret(result.data.secret);
		}
		setMsg("Webhook ایجاد شد. secret را یک‌بار کپی کنید.");
	}

	async function handleSave() {
		if (!selectedId || !canEdit) return;
		const result = await updateWebhookEndpoint(workspaceId, selectedId, draft);
		if (!result.ok) {
			setError(result.error ?? "خطا");
			return;
		}
		if (result.data) {
			setEndpoints((prev) =>
				prev.map((e) => (e.id === result.data!.id ? result.data! : e)),
			);
		}
		setMsg("ذخیره شد.");
	}

	async function handleDelete() {
		if (!selectedId || !canEdit) return;
		if (!confirm("این webhook حذف شود؟")) return;
		const ok = await deleteWebhookEndpoint(workspaceId, selectedId);
		if (!ok) {
			setError("حذف ناموفق بود.");
			return;
		}
		setEndpoints((prev) => prev.filter((e) => e.id !== selectedId));
		setSelectedId(null);
		setRevealedSecret(null);
	}

	async function handleRotate() {
		if (!selectedId || !canEdit) return;
		if (!confirm("secret جدید صادر شود؟ اتصال‌های قبلی تا به‌روزرسانی secret قطع می‌شوند."))
			return;
		const result = await rotateWebhookSecret(workspaceId, selectedId);
		if (!result.secret) {
			setError(result.error ?? "چرخش secret ناموفق بود.");
			return;
		}
		setRevealedSecret(result.secret);
		setMsg("secret جدید صادر شد — یک‌بار کپی کنید.");
	}

	function toggleEvent(ev: WebhookEventType) {
		const current = draft.events;
		const next = current.includes(ev)
			? current.filter((e) => e !== ev)
			: [...current, ev];
		setDraft({ ...draft, events: next });
	}

	function copySecret() {
		if (!revealedSecret) return;
		void navigator.clipboard.writeText(revealedSecret);
		setMsg("secret در کلیپ‌بورد کپی شد.");
	}

	const selected = endpoints.find((e) => e.id === selectedId);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-lg font-semibold">Webhook خروجی</h1>
					<p className="text-sm text-muted-foreground">
						رویدادها به Zapier، Make یا سیستم شما با امضای HMAC (
						<code className="text-xs">X-ChatBox-Signature</code>) ارسال می‌شوند.
					</p>
				</div>
				{canEdit && (
					<Button type="button" onClick={() => void handleCreate()}>
						Webhook جدید
					</Button>
				)}
			</div>

			{revealedSecret && (
				<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
					<p className="font-medium text-amber-800 dark:text-amber-200">
						Secret (فقط یک‌بار نمایش داده می‌شود)
					</p>
					<code className="mt-2 block break-all rounded bg-background/80 p-2 text-xs">
						{revealedSecret}
					</code>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-2"
						onClick={copySecret}
					>
						کپی secret
					</Button>
				</div>
			)}

			<div className="flex min-h-0 flex-1 gap-4">
				<aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
					{endpoints.length === 0 ? (
						<p className="p-2 text-xs text-muted-foreground">
							webhookی تعریف نشده.
						</p>
					) : (
						endpoints.map((e) => (
							<button
								key={e.id}
								type="button"
								onClick={() => {
									setSelectedId(e.id);
									setRevealedSecret(null);
								}}
								className={cn(
									"rounded-md px-2 py-2 text-start text-sm transition-colors",
									e.id === selectedId
										? "bg-primary/10 text-primary"
										: "hover:bg-accent",
								)}
							>
								<span className="font-medium">{e.name}</span>
								<span className="mt-0.5 block truncate text-xs text-muted-foreground">
									{e.url}
									{e.enabled ? "" : " · غیرفعال"}
								</span>
							</button>
						))
					)}
				</aside>

				{selectedId && selected ? (
					<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
						<div className="rounded-lg border border-border bg-card p-4">
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
								<label className="block text-sm sm:col-span-2">
									<span className="text-muted-foreground">URL (HTTPS)</span>
									<input
										className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
										value={draft.url}
										disabled={!canEdit}
										onChange={(e) =>
											setDraft({ ...draft, url: e.target.value })
										}
									/>
								</label>
							</div>

							<label className="mt-3 flex items-center gap-2 text-sm">
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

							<fieldset className="mt-3 space-y-2">
								<legend className="text-sm font-medium">رویدادها</legend>
								<div className="flex flex-wrap gap-2">
									{ALL_EVENTS.map((ev) => (
										<button
											key={ev.value}
											type="button"
											disabled={!canEdit}
											onClick={() => toggleEvent(ev.value)}
											className={cn(
												"rounded-full border px-3 py-1 text-xs",
												draft.events.includes(ev.value)
													? "border-primary bg-primary/10 text-primary"
													: "border-border text-muted-foreground",
											)}
										>
											{ev.label}
										</button>
									))}
								</div>
							</fieldset>

							<p className="mt-2 text-xs text-muted-foreground">
								پیش‌نمایش secret:{" "}
								<code>{selected.secret_preview}</code>
							</p>

							{canEdit && (
								<div className="mt-4 flex flex-wrap gap-2">
									<Button type="button" onClick={() => void handleSave()}>
										ذخیره
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => void handleRotate()}
									>
										چرخش secret
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

						<div className="rounded-lg border border-border bg-card p-4">
							<div className="mb-2 flex items-center justify-between">
								<h2 className="text-sm font-medium">لاگ ارسال</h2>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => void reloadDeliveries()}
								>
									بروزرسانی
								</Button>
							</div>
							{deliveries.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									هنوز ارسالی ثبت نشده.
								</p>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-xs">
										<thead>
											<tr className="border-b text-muted-foreground">
												<th className="py-1 text-start">رویداد</th>
												<th className="py-1 text-start">وضعیت</th>
												<th className="py-1 text-start">HTTP</th>
												<th className="py-1 text-start">تلاش</th>
												<th className="py-1 text-start">زمان</th>
											</tr>
										</thead>
										<tbody>
											{deliveries.map((d) => (
												<tr key={d.id} className="border-b border-border/50">
													<td className="py-1.5 font-mono">{d.event}</td>
													<td className="py-1.5">
														{STATUS_LABELS[d.status] ?? d.status}
													</td>
													<td className="py-1.5">
														{d.httpStatus ?? "—"}
													</td>
													<td className="py-1.5">{d.attempts}</td>
													<td className="py-1.5 text-muted-foreground">
														{new Date(d.createdAt).toLocaleString("fa-IR")}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						webhookی انتخاب کنید یا endpoint جدید بسازید.
					</div>
				)}
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}
			{msg && <p className="text-sm text-primary">{msg}</p>}
		</div>
	);
}
