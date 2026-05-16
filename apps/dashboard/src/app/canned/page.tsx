"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { CannedResponsesManager } from "@/components/CannedResponsesManager";
import { AppShell } from "@/components/layout/AppShell";

export default function CannedPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName }) => (
				<AppShell userEmail={userEmail} workspaceName={workspaceName}>
					<CannedResponsesManager workspaceId={workspaceId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
