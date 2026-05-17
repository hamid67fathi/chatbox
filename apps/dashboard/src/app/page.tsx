"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Inbox } from "@/components/Inbox";
import { AppShell } from "@/components/layout/AppShell";

export default function HomePage() {
	return (
		<AuthGuard>
			{({ workspaceId, userId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<Inbox
						workspaceId={workspaceId}
						userId={userId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
