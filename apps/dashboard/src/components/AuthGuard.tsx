"use client";

import { fetchWorkspaces } from "@/lib/api";
import { clearAuth, getWorkspaceIdFromAuth, refreshAuthUser } from "@/lib/auth-store";
import { disconnectSocket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

interface Props {
	children: (context: { workspaceId: string; userId: string }) => ReactNode;
}

export function AuthGuard({ children }: Props) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	const [ctx, setCtx] = useState<{ workspaceId: string; userId: string } | null>(null);
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

				let wsId =
					workspaces.find((w) => w.slug === "demo")?.id ??
					workspaces[0]?.id ??
					getWorkspaceIdFromAuth();

				if (!wsId) {
					setConnError(
						error ??
							"Workspace not found. Set NEXT_PUBLIC_WORKSPACE_ID in .env.local",
					);
					return;
				}

				setConnError(null);
				setCtx({ workspaceId: wsId, userId: auth.user.id });
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
			<div
				style={{
					minHeight: "100vh",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 12,
					padding: 24,
					textAlign: "center",
				}}
			>
				<p style={{ color: "#b91c1c", fontSize: 16 }}>{connError}</p>
				<p style={{ color: "#64748b", fontSize: 14 }}>
					ترمینال API: <code>pnpm --filter api dev</code>
					<br />
					سپس صفحه را رفرش کنید.
				</p>
			</div>
		);
	}

	if (!ready || !ctx) {
		return (
			<div
				style={{
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 18,
					color: "#64748b",
				}}
			>
				در حال بارگذاری…
			</div>
		);
	}

	return <>{children(ctx)}</>;
}
