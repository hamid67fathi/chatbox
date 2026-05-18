"use client";

import { Button } from "@/components/ui/button";
import {
	fetchPlugins,
	installPlugin,
	uninstallPlugin,
	updatePluginEnabled,
	type PluginCatalogItem,
} from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

const CATEGORY_LABELS: Record<string, string> = {
	automation: "اتوماسیون",
	developer: "توسعه‌دهنده",
};

export function PluginMarketplacePanel({ workspaceId, workspaceRole }: Props) {
	const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
	const [plugins, setPlugins] = useState<PluginCatalogItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");

	const reload = useCallback(async () => {
		setLoading(true);
		const list = await fetchPlugins(workspaceId);
		setPlugins(list);
		setLoading(false);
	}, [workspaceId]);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function handleInstall(plugin: PluginCatalogItem) {
		if (!canEdit) return;
		setMsg("");
		setError("");
		let webhookUrl: string | undefined;
		if (plugin.integration_type === "webhook") {
			const url = prompt(
				`آدرس HTTPS webhook از ${plugin.name} (اختیاری — می‌توانید بعداً در Webhook تنظیم کنید):`,
			);
			if (url === null) return;
			webhookUrl = url.trim() || undefined;
		}
		const result = await installPlugin(workspaceId, plugin.slug, {
			webhook_url: webhookUrl,
		});
		if (!result.ok) {
			setError(result.error ?? "نصب ناموفق بود.");
			return;
		}
		setMsg(`${plugin.name} نصب شد.`);
		await reload();
	}

	async function handleUninstall(plugin: PluginCatalogItem) {
		if (!canEdit) return;
		if (!confirm(`حذف افزونه «${plugin.name}» از workspace؟`)) return;
		const ok = await uninstallPlugin(workspaceId, plugin.slug);
		if (!ok) {
			setError("حذف ناموفق بود.");
			return;
		}
		setMsg(`${plugin.name} حذف شد.`);
		await reload();
	}

	async function toggleEnabled(plugin: PluginCatalogItem) {
		if (!canEdit || !plugin.installed) return;
		const ok = await updatePluginEnabled(
			workspaceId,
			plugin.slug,
			!plugin.enabled,
		);
		if (!ok) {
			setError("به‌روزرسانی ناموفق بود.");
			return;
		}
		await reload();
	}

	if (loading) {
		return (
			<p className="text-sm text-muted-foreground">در حال بارگذاری افزونه‌ها…</p>
		);
	}

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				مرحله اول marketplace: اتصال Zapier، Make و Webhook سفارشی بر پایه
				رویدادهای outbound (FL-34). افزونه‌های iframe در فاز بعد.
			</p>

			{error && <p className="text-sm text-destructive">{error}</p>}
			{msg && <p className="text-sm text-primary">{msg}</p>}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{plugins.map((plugin) => (
					<article
						key={plugin.slug}
						className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm"
					>
						<div className="flex items-start gap-3">
							<span className="text-2xl" aria-hidden>
								{plugin.icon}
							</span>
							<div className="min-w-0 flex-1">
								<h2 className="font-semibold">{plugin.name}</h2>
								<p className="text-xs text-muted-foreground">
									{CATEGORY_LABELS[plugin.category] ?? plugin.category}
								</p>
							</div>
						</div>
						<p className="mt-3 flex-1 text-sm text-muted-foreground">
							{plugin.description}
						</p>
						{plugin.installed && (
							<p className="mt-2 text-xs text-primary">✓ نصب‌شده</p>
						)}
						<div className="mt-4 flex flex-wrap gap-2">
							{plugin.installed ? (
								<>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={!canEdit}
										onClick={() => void toggleEnabled(plugin)}
									>
										{plugin.enabled ? "غیرفعال" : "فعال"}
									</Button>
									{plugin.setup_path && (
										<Link
											href={plugin.setup_path}
											className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
										>
											تنظیم Webhook
										</Link>
									)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={!canEdit}
										onClick={() => void handleUninstall(plugin)}
									>
										حذف
									</Button>
								</>
							) : (
								<Button
									type="button"
									size="sm"
									disabled={!canEdit}
									onClick={() => void handleInstall(plugin)}
								>
									نصب
								</Button>
							)}
							{plugin.docs_url && (
								<a
									href={plugin.docs_url}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center px-2 py-1.5 text-xs text-primary hover:underline"
								>
									مستندات
								</a>
							)}
						</div>
					</article>
				))}
			</div>
		</div>
	);
}
