"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Inbox } from "@/components/Inbox";
import { AppShell } from "@/components/layout/AppShell";

export default function HomePage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName }) => (
				<AppShell userEmail={userEmail} workspaceName={workspaceName}>
					<Inbox workspaceId={workspaceId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
