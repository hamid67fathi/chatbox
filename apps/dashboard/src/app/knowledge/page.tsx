"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { KnowledgePanel } from "@/components/KnowledgePanel";
import { AppShell } from "@/components/layout/AppShell";

export default function KnowledgePage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<KnowledgePanel workspaceId={workspaceId} workspaceRole={workspaceRole} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
