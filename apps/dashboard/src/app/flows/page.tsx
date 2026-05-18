"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { FlowBuilderPanel } from "@/components/FlowBuilderPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function FlowsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<FlowBuilderPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
