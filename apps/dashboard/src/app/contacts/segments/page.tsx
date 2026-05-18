"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { ContactSegmentsPanel } from "@/components/ContactSegmentsPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function ContactSegmentsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<ContactSegmentsPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
