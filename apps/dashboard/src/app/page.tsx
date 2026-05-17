"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Inbox } from "@/components/Inbox";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

export default function HomePage() {
	return (
		<AuthGuard>
			{({ workspaceId, userId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<Suspense
						fallback={
							<div className="flex flex-1 items-center justify-center">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						}
					>
						<Inbox
							workspaceId={workspaceId}
							userId={userId}
							workspaceRole={workspaceRole}
						/>
					</Suspense>
				</AppShell>
			)}
		</AuthGuard>
	);
}
