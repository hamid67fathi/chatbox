"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { OnlineVisitorsPanel } from "@/components/OnlineVisitorsPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function VisitorsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userId, userEmail, workspaceName }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<OnlineVisitorsPanel workspaceId={workspaceId} userId={userId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
