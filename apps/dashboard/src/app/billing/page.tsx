"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { BillingPanel } from "@/components/BillingPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function BillingPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<BillingPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
