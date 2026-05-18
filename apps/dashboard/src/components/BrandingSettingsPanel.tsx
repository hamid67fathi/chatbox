"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	fetchBranding,
	publicAssetUrl,
	updateBranding,
	type BrandingPublic,
} from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
}

export function BrandingSettingsPanel({ workspaceId }: Props) {
	const [enterprise, setEnterprise] = useState(false);
	const [enabled, setEnabled] = useState(false);
	const [logoUrl, setLogoUrl] = useState("");
	const [primaryColor, setPrimaryColor] = useState("#7c3aed");
	const [dashboardTitle, setDashboardTitle] = useState("");
	const [hidePoweredBy, setHidePoweredBy] = useState(false);
	const [customDomain, setCustomDomain] = useState("");
	const [emailFromName, setEmailFromName] = useState("");
	const [widgetLabel, setWidgetLabel] = useState("");
	const [widgetUrl, setWidgetUrl] = useState("");
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	const apply = useCallback((data: BrandingPublic | undefined) => {
		if (!data) return;
		setEnabled(data.enabled);
		setLogoUrl(data.logo_url ?? "");
		setPrimaryColor(data.primary_color ?? "#7c3aed");
		setDashboardTitle(data.dashboard_title ?? "");
		setHidePoweredBy(data.hide_powered_by);
		setCustomDomain(data.custom_domain ?? "");
		setEmailFromName(data.email_from_name ?? "");
		setWidgetLabel(data.widget_branding_label ?? "");
		setWidgetUrl(data.widget_branding_url ?? "");
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		const res = await fetchBranding(workspaceId);
		setEnterprise(res?.enterprise ?? false);
		apply(res?.branding);
		setLoading(false);
	}, [workspaceId, apply]);

	useEffect(() => {
		void load();
	}, [load]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setMsg("");
		setError("");
		const ok = await updateBranding(workspaceId, {
			enabled,
			logo_url: logoUrl.trim() || null,
			primary_color: primaryColor,
			dashboard_title: dashboardTitle.trim() || null,
			hide_powered_by: hidePoweredBy,
			custom_domain: customDomain.trim() || null,
			email_from_name: emailFromName.trim() || null,
			widget_branding_label: widgetLabel.trim() || null,
			widget_branding_url: widgetUrl.trim() || null,
		});
		if (!ok) {
			setError("ذخیره برندینگ ناموفق بود.");
			return;
		}
		setMsg("تنظیمات White-label ذخیره شد.");
		await load();
	}

	if (loading) {
		return (
			<p className="text-sm text-muted-foreground">در حال بارگذاری برندینگ…</p>
		);
	}

	if (!enterprise) {
		return (
			<div className="mx-auto max-w-lg rounded-lg border border-border bg-muted/30 p-6 text-sm">
				<p className="font-medium">White-label (Enterprise)</p>
				<p className="mt-2 text-muted-foreground">
					لوگو، رنگ، حذف برند ChatBox و دامنه سفارشی فقط در پلن Enterprise
					فعال می‌شود.
				</p>
				<Link
					href="/billing"
					className="mt-4 inline-block font-medium text-primary hover:underline"
				>
					مشاهده پلن‌ها →
				</Link>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="mx-auto flex max-w-lg flex-col gap-4"
		>
			<p className="text-sm text-muted-foreground">
				برندینگ داشبورد و ویجت. برای دامنه سفارشی، رکورد DNS و پیکربندی Nginx
				روی سرور لازم است.
			</p>

			<label className="flex items-center gap-2 text-sm font-medium">
				<input
					type="checkbox"
					checked={enabled}
					onChange={(e) => setEnabled(e.target.checked)}
				/>
				فعال‌سازی White-label
			</label>

			<label className="flex flex-col gap-1 text-sm font-medium">
				عنوان داشبورد
				<Input
					value={dashboardTitle}
					onChange={(e) => setDashboardTitle(e.target.value)}
					placeholder="پشتیبانی مشتریان"
				/>
			</label>

			<label className="flex flex-col gap-1 text-sm font-medium">
				آدرس لوگو (URL)
				<Input
					value={logoUrl}
					onChange={(e) => setLogoUrl(e.target.value)}
					dir="ltr"
					placeholder="/uploads/... یا https://"
				/>
			</label>
			{logoUrl && publicAssetUrl(logoUrl) && (
				<img
					src={publicAssetUrl(logoUrl)!}
					alt=""
					className="h-12 w-auto max-w-[200px] object-contain"
				/>
			)}

			<label className="flex flex-col gap-1 text-sm font-medium">
				رنگ اصلی (ویجت و داشبورد)
				<Input
					type="color"
					value={primaryColor}
					onChange={(e) => setPrimaryColor(e.target.value)}
					className="h-10 w-20"
				/>
			</label>

			<label className="flex flex-col gap-1 text-sm font-medium">
				دامنه سفارشی (مرجع)
				<Input
					value={customDomain}
					onChange={(e) => setCustomDomain(e.target.value)}
					dir="ltr"
					placeholder="support.example.com"
				/>
			</label>

			<label className="flex flex-col gap-1 text-sm font-medium">
				نام فرستنده ایمیل
				<Input
					value={emailFromName}
					onChange={(e) => setEmailFromName(e.target.value)}
					placeholder="تیم پشتیبانی"
				/>
			</label>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={hidePoweredBy}
					onChange={(e) => setHidePoweredBy(e.target.checked)}
				/>
				حذف «قدرت گرفته از ChatBox» از ویجت
			</label>

			<p className="text-sm font-medium">برندینگ اختیاری ویجت (اگر حذف نشده)</p>
			<label className="flex flex-col gap-1 text-sm">
				متن فوتر ویجت
				<Input
					value={widgetLabel}
					onChange={(e) => setWidgetLabel(e.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-1 text-sm">
				لینک فوتر ویجت
				<Input
					value={widgetUrl}
					onChange={(e) => setWidgetUrl(e.target.value)}
					dir="ltr"
				/>
			</label>

			{error && <p className="text-sm text-destructive">{error}</p>}
			{msg && <p className="text-sm text-primary">{msg}</p>}
			<Button type="submit">ذخیره برندینگ</Button>
		</form>
	);
}
