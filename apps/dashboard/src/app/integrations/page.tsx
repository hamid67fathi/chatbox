"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { PluginMarketplacePanel } from "@/components/PluginMarketplacePanel";
import { AppShell } from "@/components/layout/AppShell";

export default function IntegrationsPage() {
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
							<h1 className="text-lg font-semibold">افزونه‌ها و اتصال‌ها</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Marketplace داخلی — Zapier، Make و Webhook
							</p>
						</div>
						<div className="flex-1 overflow-y-auto p-6">
							<PluginMarketplacePanel
								workspaceId={workspaceId}
								workspaceRole={workspaceRole}
							/>
						</div>
					</div>
				</AppShell>
			)}
		</AuthGuard>
	);
}
