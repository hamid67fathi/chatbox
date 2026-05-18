"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { RoutingRulesPanel } from "@/components/RoutingRulesPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function RoutingPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<RoutingRulesPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
