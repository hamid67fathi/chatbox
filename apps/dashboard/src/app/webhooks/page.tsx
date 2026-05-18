"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { WebhookEndpointsPanel } from "@/components/WebhookEndpointsPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function WebhooksPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<WebhookEndpointsPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
