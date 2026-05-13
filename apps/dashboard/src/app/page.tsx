"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Inbox } from "@/components/Inbox";

export default function HomePage() {
	return (
		<AuthGuard>
			{({ workspaceId }) => <Inbox workspaceId={workspaceId} />}
		</AuthGuard>
	);
}
