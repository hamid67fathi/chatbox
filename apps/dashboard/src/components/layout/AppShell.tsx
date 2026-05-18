"use client";

import { BrandingProvider } from "@/components/BrandingProvider";
import type { ReactNode } from "react";
import { AiBudgetBanner } from "./AiBudgetBanner";
import { PlanUsageBanner } from "./PlanUsageBanner";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface Props {
	children: ReactNode;
	workspaceId?: string;
	userEmail?: string;
	workspaceName?: string;
}

export function AppShell({
	children,
	workspaceId,
	userEmail,
	workspaceName,
}: Props) {
	return (
		<BrandingProvider workspaceId={workspaceId}>
			<div className="flex h-screen overflow-hidden bg-background text-foreground">
				<Sidebar />
				<div className="flex min-w-0 flex-1 flex-col">
					<Header userEmail={userEmail} workspaceName={workspaceName} />
					{workspaceId ? (
						<>
							<AiBudgetBanner workspaceId={workspaceId} />
							<PlanUsageBanner workspaceId={workspaceId} />
						</>
					) : null}
					<main className="flex min-h-0 flex-1 flex-col">{children}</main>
				</div>
			</div>
		</BrandingProvider>
	);
}
