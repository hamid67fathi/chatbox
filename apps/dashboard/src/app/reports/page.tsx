"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { ReportsPanel } from "@/components/ReportsPanel";
export default function ReportsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<ReportsPanel workspaceId={workspaceId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
