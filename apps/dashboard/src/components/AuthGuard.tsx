"use client";

import { fetchWorkspaces } from "@/lib/api";
import { getWorkspaceIdFromAuth, refreshAuthUser } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

export interface AuthContext {
	workspaceId: string;
	userId: string;
	userEmail: string;
	workspaceName: string;
	workspaceRole: string;
}

interface Props {
	children: (context: AuthContext) => ReactNode;
}

export function AuthGuard({ children }: Props) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	const [ctx, setCtx] = useState<AuthContext | null>(null);
	const [connError, setConnError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const auth = await refreshAuthUser();
				if (cancelled) return;

				if (!auth?.access_token) {
					router.replace("/login");
					return;
				}

				const { data: workspaces, error } = await fetchWorkspaces();
				if (cancelled) return;

				const demo = workspaces.find((w) => w.slug === "demo");
				const primary = demo ?? workspaces[0];
				let wsId = primary?.id ?? getWorkspaceIdFromAuth();

				if (!wsId) {
					setConnError(
						error ??
							"Workspace not found. Set NEXT_PUBLIC_WORKSPACE_ID in .env.local",
					);
					return;
				}

				setConnError(null);
				setCtx({
					workspaceId: wsId,
					userId: auth.user.id,
					userEmail: auth.user.email,
					workspaceName: primary?.name ?? "ورک‌اسپیس",
					workspaceRole: primary?.role ?? "agent",
				});
				setReady(true);
			} catch (err) {
				if (!cancelled) {
					setConnError(err instanceof Error ? err.message : "Connection failed");
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [router]);

	if (connError) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
				<p className="text-base text-destructive">{connError}</p>
				<p className="text-sm text-muted-foreground">
					ترمینال API: <code className="rounded bg-muted px-1.5 py-0.5">pnpm --filter api dev</code>
					<br />
					سپس صفحه را رفرش کنید.
				</p>
			</div>
		);
	}

	if (!ready || !ctx) {
		return (
			<div className="flex min-h-screen items-center justify-center text-lg text-muted-foreground">
				در حال بارگذاری…
			</div>
		);
	}

	return <>{children(ctx)}</>;
}
