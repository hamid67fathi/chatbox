"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";

export default function SettingsAuditPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => {
				const canView =
					workspaceRole === "owner" || workspaceRole === "admin";
				return (
					<AppShell
						workspaceId={workspaceId}
						userEmail={userEmail}
						workspaceName={workspaceName}
					>
						<div className="flex h-full min-h-0 flex-col">
							<div className="border-b border-border px-6 py-4">
								<Link
									href="/settings"
									className="text-sm text-primary hover:underline"
								>
									← بازگشت به تنظیمات
								</Link>
								<h1 className="mt-2 text-lg font-semibold">لاگ حسابرسی</h1>
							</div>
							<div className="flex-1 overflow-y-auto p-6">
								{canView ? (
									<AuditLogPanel workspaceId={workspaceId} />
								) : (
									<p className="text-sm text-muted-foreground">
										فقط owner و admin می‌توانند لاگ حسابرسی را ببینند.
									</p>
								)}
							</div>
						</div>
					</AppShell>
				);
			}}
		</AuthGuard>
	);
}
