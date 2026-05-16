"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { TeamPanel } from "@/components/TeamPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function TeamPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell userEmail={userEmail} workspaceName={workspaceName}>
					<TeamPanel
						workspaceId={workspaceId}
						userId={userId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
