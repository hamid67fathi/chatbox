"use client";

import type { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface Props {
	children: ReactNode;
	userEmail?: string;
	workspaceName?: string;
}

export function AppShell({ children, userEmail, workspaceName }: Props) {
	return (
		<div className="flex h-screen overflow-hidden bg-background text-foreground">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<Header userEmail={userEmail} workspaceName={workspaceName} />
				<main className="flex min-h-0 flex-1 flex-col">{children}</main>
			</div>
		</div>
	);
}
