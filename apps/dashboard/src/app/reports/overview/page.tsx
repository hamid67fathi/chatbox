"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { ReportsOverviewPanel } from "@/components/ReportsOverviewPanel";

export default function ReportsOverviewPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<ReportsOverviewPanel workspaceId={workspaceId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
