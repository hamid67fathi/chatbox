"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/AppShell";
import { createCampaign, fetchCampaigns, type CampaignRow } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

function CampaignsContent({
	workspaceId,
	canEdit,
}: {
	workspaceId: string;
	canEdit: boolean;
}) {
	const [rows, setRows] = useState<CampaignRow[]>([]);
	const [name, setName] = useState("");
	const [template, setTemplate] = useState("سلام {{name}}!");

	const load = useCallback(async () => {
		setRows(await fetchCampaigns(workspaceId));
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<div className="flex-1 space-y-4 overflow-y-auto p-6">
			{canEdit && (
				<form
					className="flex max-w-xl flex-col gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						void createCampaign(workspaceId, {
							name,
							message_template: template,
						}).then(() => {
							setName("");
							void load();
						});
					}}
				>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="نام کمپین"
						required
					/>
					<Input
						value={template}
						onChange={(e) => setTemplate(e.target.value)}
						placeholder="متن پیام"
					/>
					<Button type="submit" size="sm" className="w-fit">
						ایجاد پیش‌نویس
					</Button>
				</form>
			)}
			<ul className="divide-y rounded-md border text-sm">
				{rows.map((c) => (
					<li key={c.id} className="p-3">
						<p className="font-medium">{c.name}</p>
						<p className="text-xs text-muted-foreground">وضعیت: {c.status}</p>
					</li>
				))}
			</ul>
		</div>
	);
}

export default function CampaignsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div className="border-b border-border px-6 py-4">
							<h1 className="text-lg font-semibold">کمپین‌های پیام</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								ارسال outbound به بخش مخاطبان (فاز ۱ — ثبت و مدیریت)
							</p>
						</div>
						<CampaignsContent
							workspaceId={workspaceId}
							canEdit={workspaceRole === "owner" || workspaceRole === "admin"}
						/>
					</div>
				</AppShell>
			)}
		</AuthGuard>
	);
}
