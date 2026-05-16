"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AppShell } from "@/components/layout/AppShell";

export default function SettingsPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell userEmail={userEmail} workspaceName={workspaceName}>
					<SettingsPanel
						workspaceId={workspaceId}
						workspaceRole={workspaceRole}
						userEmail={userEmail}
					/>
				</AppShell>
			)}
		</AuthGuard>
	);
}
