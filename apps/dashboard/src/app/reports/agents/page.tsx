"use client";

import { AgentPerformancePanel } from "@/components/AgentPerformancePanel";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function AgentReportsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<AgentPerformancePanel workspaceId={workspaceId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
