"use client";

import { Button } from "@/components/ui/button";
import type { NotificationPreferences } from "@/lib/api";
import { updateNotificationPreferences } from "@/lib/api";
import {
	browserNotificationsSupported,
	getBrowserNotificationPermission,
	previewBrowserNotification,
	requestBrowserNotificationPermission,
} from "@/lib/browser-notifications";
import {
	fetchNotificationPreferences,
	getLocalPushSubscription,
	pushSupported,
	subscribeToPush,
	unsubscribeFromPush,
} from "@/lib/notifications";
import {
	previewNotificationSound,
	setNotificationSoundPrefsCache,
} from "@/lib/notification-sound-prefs";
import { NOTIFICATION_SOUND_IDS } from "@chatbox/shared/notification-sound";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
}

export function NotificationSettings({ workspaceId }: Props) {
	const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
	const [subscribed, setSubscribed] = useState(false);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");
	const [browserPerm, setBrowserPerm] = useState<
		NotificationPermission | "unsupported"
	>("default");

	const reload = useCallback(async () => {
		setLoading(true);
		const [p, sub] = await Promise.all([
			fetchNotificationPreferences(workspaceId),
			getLocalPushSubscription(),
		]);
		setPrefs(p);
		if (p) setNotificationSoundPrefsCache(workspaceId, p);
		setSubscribed(Boolean(sub));
		setLoading(false);
	}, [workspaceId]);

	useEffect(() => {
		void reload();
		setBrowserPerm(getBrowserNotificationPermission());
	}, [reload]);

	async function savePrefs(patch: Partial<NotificationPreferences>) {
		const next = await updateNotificationPreferences(workspaceId, patch);
		if (next) {
			setPrefs(next);
			setNotificationSoundPrefsCache(workspaceId, next);
			setMsg("تنظیمات ذخیره شد.");
		}
	}

	async function handleSubscribe() {
		setBusy(true);
		setError("");
		const result = await subscribeToPush(workspaceId);
		setBusy(false);
		if (!result.ok) {
			setError(result.error ?? "اشتراک ناموفق بود.");
			return;
		}
		setSubscribed(true);
		setMsg("اعلان Push فعال شد.");
		await savePrefs({ push_enabled: true });
	}

	async function handleUnsubscribe() {
		setBusy(true);
		await unsubscribeFromPush(workspaceId);
		setBusy(false);
		setSubscribed(false);
		setMsg("اشتراک Push لغو شد.");
		await savePrefs({ push_enabled: false });
	}

	if (loading) {
		return <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>;
	}

	return (
		<div className="mx-auto flex max-w-md flex-col gap-4">
			{prefs && (
				<div className="space-y-3 rounded-lg border border-border bg-card p-4">
					<p className="text-sm font-medium">صدای پیام جدید (صندوق ورودی)</p>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={prefs.sound_enabled}
							onChange={(e) =>
								void savePrefs({ sound_enabled: e.target.checked })
							}
						/>
						پخش صدا هنگام پیام مشتری
					</label>
					<label className="block text-sm">
						<span className="text-muted-foreground">نوع صدا</span>
						<select
							className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
							disabled={!prefs.sound_enabled}
							value={prefs.sound_id}
							onChange={(e) =>
								void savePrefs({ sound_id: e.target.value })
							}
						>
							{NOTIFICATION_SOUND_IDS.map((id) => (
								<option key={id} value={id}>
									{id === "default"
										? "پیش‌فرض"
										: id === "chime"
											? "زنگ"
											: "ملایم"}
								</option>
							))}
						</select>
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							disabled={!prefs.sound_enabled}
							checked={prefs.sound_when_hidden}
							onChange={(e) =>
								void savePrefs({ sound_when_hidden: e.target.checked })
							}
						/>
						پخش وقتی تب مرورگر در پس‌زمینه است
					</label>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={!prefs.sound_enabled}
						onClick={() => previewNotificationSound(prefs.sound_id)}
					>
						پیش‌نمایش صدا
					</Button>
					<p className="text-xs text-muted-foreground">
						در مکالمهٔ باز و تب فعال صدا پخش نمی‌شود.
					</p>
				</div>
			)}

			{prefs && browserNotificationsSupported() && (
				<div className="space-y-3 rounded-lg border border-border bg-card p-4">
					<p className="text-sm font-medium">اعلان مرورگر (تب در پس‌زمینه)</p>
					<p className="text-xs text-muted-foreground">
						وقتی تب ChatBox باز است ولی فعال نیست، اعلان دسکتاپ نمایش داده
						می‌شود (بدون نیاز به VAPID).
					</p>
					<p className="text-sm text-muted-foreground">
						مجوز:{" "}
						{browserPerm === "granted"
							? "داده شده"
							: browserPerm === "denied"
								? "رد شده — از تنظیمات مرورگر فعال کنید"
								: browserPerm === "unsupported"
									? "پشتیبانی نمی‌شود"
									: "هنوز درخواست نشده"}
					</p>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={browserPerm === "denied"}
						onClick={() => {
							void requestBrowserNotificationPermission().then((p) => {
								setBrowserPerm(p);
								if (p === "granted") {
									previewBrowserNotification();
									setMsg("اعلان مرورگر فعال شد.");
								} else if (p === "denied") {
									setError("مرورگر اجازه اعلان را نداد.");
								}
							});
						}}
					>
						درخواست مجوز اعلان
					</Button>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={prefs.browser_enabled}
							disabled={browserPerm !== "granted"}
							onChange={(e) =>
								void savePrefs({ browser_enabled: e.target.checked })
							}
						/>
						فعال‌سازی اعلان مرورگر
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							disabled={!prefs.browser_enabled || browserPerm !== "granted"}
							checked={prefs.browser_new_conversation}
							onChange={(e) =>
								void savePrefs({
									browser_new_conversation: e.target.checked,
								})
							}
						/>
						مکالمه جدید
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							disabled={!prefs.browser_enabled || browserPerm !== "granted"}
							checked={prefs.browser_new_message}
							onChange={(e) =>
								void savePrefs({ browser_new_message: e.target.checked })
							}
						/>
						پیام جدید مشتری
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							disabled={!prefs.browser_enabled || browserPerm !== "granted"}
							checked={prefs.browser_needs_human}
							onChange={(e) =>
								void savePrefs({ browser_needs_human: e.target.checked })
							}
						/>
						نیاز به اپراتور (AI)
					</label>
				</div>
			)}

			{!pushSupported() ? (
				<p className="text-sm text-muted-foreground">
					مرورگر شما از Web Push پشتیبانی نمی‌کند.
				</p>
			) : (
				<>
			<p className="text-sm text-muted-foreground">
				وقتی اپراتور آفلاین است، اعلان مکالمه و پیام جدید در سیستم‌عامل نمایش
				داده می‌شود (نیاز به VAPID روی سرور).
			</p>

			<div className="rounded-lg border border-border bg-card p-4">
				<p className="mb-2 text-sm font-medium">وضعیت اشتراک</p>
				<p className="text-sm text-muted-foreground">
					{subscribed ? "فعال — این دستگاه ثبت شده است" : "غیرفعال"}
				</p>
				<div className="mt-3 flex gap-2">
					{!subscribed ? (
						<Button
							type="button"
							size="sm"
							disabled={busy}
							onClick={() => void handleSubscribe()}
						>
							فعال‌سازی اعلان Push
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={busy}
							onClick={() => void handleUnsubscribe()}
						>
							لغو اشتراک
						</Button>
					)}
				</div>
			</div>

			{prefs && (
				<>
					<div className="space-y-3 rounded-lg border border-border bg-card p-4">
						<p className="text-sm font-medium">Push — چه زمانی؟</p>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={prefs.new_conversation}
								onChange={(e) =>
									void savePrefs({ new_conversation: e.target.checked })
								}
							/>
							مکالمه جدید
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={prefs.new_message}
								onChange={(e) =>
									void savePrefs({ new_message: e.target.checked })
								}
							/>
							پیام جدید از مشتری (Push)
						</label>
					</div>
					<div className="space-y-3 rounded-lg border border-border bg-card p-4">
						<p className="text-sm font-medium">ایمیل — SMTP ورک‌اسپیس</p>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={prefs.email_enabled}
								onChange={(e) =>
									void savePrefs({ email_enabled: e.target.checked })
								}
							/>
							فعال‌سازی اعلان ایمیل
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								disabled={!prefs.email_enabled}
								checked={prefs.email_new_conversation}
								onChange={(e) =>
									void savePrefs({
										email_new_conversation: e.target.checked,
									})
								}
							/>
							مکالمه جدید
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								disabled={!prefs.email_enabled}
								checked={prefs.email_assigned}
								onChange={(e) =>
									void savePrefs({ email_assigned: e.target.checked })
								}
							/>
							اختصاص مکالمه به من
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								disabled={!prefs.email_enabled}
								checked={prefs.email_mention}
								onChange={(e) =>
									void savePrefs({ email_mention: e.target.checked })
								}
							/>
							اشاره در یادداشت (@ایمیل یا @uuid)
						</label>
					</div>
				</>
			)}
				</>
			)}

			{error && <p className="text-sm text-destructive">{error}</p>}
			{msg && <p className="text-sm text-primary">{msg}</p>}
		</div>
	);
}
