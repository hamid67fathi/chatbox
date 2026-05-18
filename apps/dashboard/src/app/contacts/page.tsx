"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { ContactsListPanel } from "@/components/ContactsListPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function ContactsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<ContactsListPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
