"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { BillingPanel } from "@/components/BillingPanel";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function BillingContent({
	workspaceId,
	workspaceRole,
	userEmail,
	workspaceName,
}: {
	workspaceId: string;
	workspaceRole: string;
	userEmail: string;
	workspaceName: string;
}) {
	return (
		<AppShell
			workspaceId={workspaceId}
			userEmail={userEmail}
			workspaceName={workspaceName}
		>
			<BillingPanel workspaceId={workspaceId} workspaceRole={workspaceRole} />
		</AppShell>
	);
}

export default function BillingPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<Suspense
					fallback={
						<div className="flex justify-center p-12">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					}
				>
					<BillingContent
						workspaceId={workspaceId}
						userEmail={userEmail}
						workspaceName={workspaceName}
						workspaceRole={workspaceRole}
					/>
				</Suspense>
			)}
		</AuthGuard>
	);
}
