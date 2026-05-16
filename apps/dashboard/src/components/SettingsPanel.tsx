"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	API_URL,
	fetchWidgetConfig,
	fetchWorkspaceDetail,
	updateProfile,
	updateWidgetConfig,
	updateWorkspace,
	type WidgetConfigPublic,
} from "@/lib/api";
import { refreshAuthUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
	userEmail: string;
}

const LOCALES = [
	{ value: "fa-IR", label: "فارسی (ایران)" },
	{ value: "en-US", label: "English (US)" },
];

const TIMEZONES = [
	{ value: "Asia/Tehran", label: "تهران" },
	{ value: "UTC", label: "UTC" },
];

export function SettingsPanel({ workspaceId, workspaceRole, userEmail }: Props) {
	const [tab, setTab] = useState<"profile" | "workspace" | "widget">("profile");
	const canEditWorkspace = workspaceRole === "owner" || workspaceRole === "admin";

	const [fullName, setFullName] = useState("");
	const [locale, setLocale] = useState("fa-IR");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [profileMsg, setProfileMsg] = useState("");
	const [profileError, setProfileError] = useState("");

	const [wsName, setWsName] = useState("");
	const [wsLocale, setWsLocale] = useState("fa-IR");
	const [wsTimezone, setWsTimezone] = useState("Asia/Tehran");
	const [wsSlug, setWsSlug] = useState("");
	const [wsMsg, setWsMsg] = useState("");
	const [wsError, setWsError] = useState("");

	const [widgetColor, setWidgetColor] = useState("#2563eb");
	const [widgetPosition, setWidgetPosition] = useState<"left" | "right">("right");
	const [widgetTitle, setWidgetTitle] = useState("پشتیبانی");
	const [widgetWelcome, setWidgetWelcome] = useState("");
	const [widgetAvatar, setWidgetAvatar] = useState("");
	const [widgetMsg, setWidgetMsg] = useState("");
	const [widgetError, setWidgetError] = useState("");

	const loadProfile = useCallback(async () => {
		const auth = await refreshAuthUser();
		if (auth?.user) {
			setFullName(auth.user.full_name ?? "");
			setLocale(auth.user.locale ?? "fa-IR");
		}
	}, []);

	const loadWorkspace = useCallback(async () => {
		const ws = await fetchWorkspaceDetail(workspaceId);
		if (ws) {
			setWsName(ws.name);
			setWsLocale(ws.locale);
			setWsTimezone(ws.timezone);
			setWsSlug(ws.slug);
		}
	}, [workspaceId]);

	const loadWidget = useCallback(async () => {
		const cfg = await fetchWidgetConfig(workspaceId);
		if (cfg) {
			setWidgetColor(cfg.primary_color);
			setWidgetPosition(cfg.position);
			setWidgetTitle(cfg.title);
			setWidgetWelcome(cfg.welcome_message);
			setWidgetAvatar(cfg.avatar_url ?? "");
		}
	}, [workspaceId]);

	useEffect(() => {
		loadProfile();
		loadWorkspace();
		loadWidget();
	}, [loadProfile, loadWorkspace, loadWidget]);

	async function saveProfile(e: React.FormEvent) {
		e.preventDefault();
		setProfileMsg("");
		setProfileError("");
		const result = await updateProfile({
			full_name: fullName,
			locale,
			...(newPassword
				? { current_password: currentPassword, new_password: newPassword }
				: {}),
		});
		if (!result.ok) {
			setProfileError(result.error ?? "ذخیره ناموفق بود.");
			return;
		}
		setProfileMsg("پروفایل ذخیره شد.");
		setCurrentPassword("");
		setNewPassword("");
		await loadProfile();
	}

	async function saveWorkspace(e: React.FormEvent) {
		e.preventDefault();
		setWsMsg("");
		setWsError("");
		const ok = await updateWorkspace(workspaceId, {
			name: wsName,
			locale: wsLocale,
			timezone: wsTimezone,
		});
		if (!ok) {
			setWsError("ذخیره ورک‌اسپیس ناموفق بود.");
			return;
		}
		setWsMsg("تنظیمات ورک‌اسپیس ذخیره شد.");
	}

	async function saveWidget(e: React.FormEvent) {
		e.preventDefault();
		setWidgetMsg("");
		setWidgetError("");
		const patch: Partial<WidgetConfigPublic> = {
			primary_color: widgetColor,
			position: widgetPosition,
			title: widgetTitle,
			welcome_message: widgetWelcome,
			avatar_url: widgetAvatar.trim() || null,
		};
		const result = await updateWidgetConfig(workspaceId, patch);
		if (!result.ok) {
			setWidgetError(result.error ?? "ذخیره ناموفق بود.");
			return;
		}
		setWidgetMsg("تنظیمات ویجت ذخیره شد.");
		await loadWidget();
	}

	const embedSnippet = wsSlug
		? `<script src="${API_URL}/widget-demo/dist/index.global.js"\n  data-api-url="${API_URL}"\n  data-workspace-slug="${wsSlug}"></script>`
		: "";

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">تنظیمات</h1>
			</div>
			<div className="flex gap-2 border-b border-border px-6 pt-3">
				{(["profile", "workspace", "widget"] as const).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={cn(
							"rounded-t-md px-4 py-2 text-sm font-medium",
							tab === t
								? "border border-b-0 border-border bg-card"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{t === "profile"
							? "پروفایل"
							: t === "workspace"
								? "ورک‌اسپیس"
								: "ویجت"}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-y-auto p-6">
				{tab === "profile" && (
					<form
						onSubmit={saveProfile}
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						<label className="flex flex-col gap-1 text-sm font-medium">
							ایمیل
							<Input value={userEmail} disabled dir="ltr" />
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							نام کامل
							<Input
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							زبان رابط
							<select
								value={locale}
								onChange={(e) => setLocale(e.target.value)}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm"
							>
								{LOCALES.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<hr className="border-border" />
						<p className="text-sm font-medium">تغییر رمز عبور</p>
						<label className="flex flex-col gap-1 text-sm">
							رمز فعلی
							<Input
								type="password"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								dir="ltr"
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm">
							رمز جدید
							<Input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								minLength={8}
								dir="ltr"
							/>
						</label>
						{profileError && (
							<p className="text-sm text-destructive">{profileError}</p>
						)}
						{profileMsg && (
							<p className="text-sm text-primary">{profileMsg}</p>
						)}
						<Button type="submit">ذخیره پروفایل</Button>
					</form>
				)}
				{tab === "widget" && (
					<form
						onSubmit={saveWidget}
						className="mx-auto flex max-w-lg flex-col gap-4"
					>
						{!canEditWorkspace && (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر می‌تواند ظاهر ویجت را ویرایش کند.
							</p>
						)}
						<label className="flex flex-col gap-1 text-sm font-medium">
							رنگ اصلی
							<div className="flex items-center gap-3">
								<input
									type="color"
									value={widgetColor}
									onChange={(e) => setWidgetColor(e.target.value)}
									disabled={!canEditWorkspace}
									className="h-10 w-14 cursor-pointer rounded border border-input disabled:opacity-50"
								/>
								<Input
									value={widgetColor}
									onChange={(e) => setWidgetColor(e.target.value)}
									disabled={!canEditWorkspace}
									dir="ltr"
									className="max-w-[8rem] font-mono text-sm"
								/>
							</div>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							موقعیت دکمه
							<select
								value={widgetPosition}
								onChange={(e) =>
									setWidgetPosition(e.target.value as "left" | "right")
								}
								disabled={!canEditWorkspace}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
							>
								<option value="right">پایین راست</option>
								<option value="left">پایین چپ</option>
							</select>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							عنوان هدر
							<Input
								value={widgetTitle}
								onChange={(e) => setWidgetTitle(e.target.value)}
								disabled={!canEditWorkspace}
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							پیام خوش‌آمد
							<textarea
								value={widgetWelcome}
								onChange={(e) => setWidgetWelcome(e.target.value)}
								disabled={!canEditWorkspace}
								rows={3}
								className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							آدرس آواتار (URL)
							<Input
								value={widgetAvatar}
								onChange={(e) => setWidgetAvatar(e.target.value)}
								disabled={!canEditWorkspace}
								dir="ltr"
								placeholder="https://..."
							/>
						</label>
						{widgetError && (
							<p className="text-sm text-destructive">{widgetError}</p>
						)}
						{widgetMsg && <p className="text-sm text-primary">{widgetMsg}</p>}
						<Button type="submit" disabled={!canEditWorkspace}>
							ذخیره ویجت
						</Button>
						{wsSlug && (
							<div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
								<p className="mb-2 text-sm font-medium">کد نصب</p>
								<pre
									className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground"
									dir="ltr"
								>
									{embedSnippet}
								</pre>
								<p className="mt-2 text-xs text-muted-foreground">
									دمو: <code className="rounded bg-muted px-1">/widget-demo/demo.html</code>
								</p>
							</div>
						)}
					</form>
				)}
				{tab === "workspace" && (
					<form
						onSubmit={saveWorkspace}
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						{!canEditWorkspace && (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند تنظیمات ورک‌اسپیس را ویرایش کند.
							</p>
						)}
						<label className="flex flex-col gap-1 text-sm font-medium">
							نام ورک‌اسپیس
							<Input
								value={wsName}
								onChange={(e) => setWsName(e.target.value)}
								disabled={!canEditWorkspace}
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							Slug (فقط خواندنی)
							<Input value={wsSlug} disabled dir="ltr" />
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							زبان پیش‌فرض
							<select
								value={wsLocale}
								onChange={(e) => setWsLocale(e.target.value)}
								disabled={!canEditWorkspace}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
							>
								{LOCALES.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							منطقه زمانی
							<select
								value={wsTimezone}
								onChange={(e) => setWsTimezone(e.target.value)}
								disabled={!canEditWorkspace}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
							>
								{TIMEZONES.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						{wsError && <p className="text-sm text-destructive">{wsError}</p>}
						{wsMsg && <p className="text-sm text-primary">{wsMsg}</p>}
						<Button type="submit" disabled={!canEditWorkspace}>
							ذخیره ورک‌اسپیس
						</Button>
					</form>
				)}
			</div>
		</div>
	);
}
