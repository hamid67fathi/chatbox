"use client";

import { fetchWorkspaces } from "@/lib/api";
import { clearAuth, refreshAuthUser } from "@/lib/auth-store";
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

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const auth = await refreshAuthUser();
			if (cancelled) return;

			if (!auth?.access_token) {
				router.replace("/login");
				return;
			}

			const { data: workspaces, error } = await fetchWorkspaces();
			if (cancelled) return;

			if (error || workspaces.length === 0) {
				clearAuth();
				disconnectSocket();
				router.replace("/login");
				return;
			}

			const demo =
				workspaces.find((w) => w.slug === "demo") ?? workspaces[0];

			setCtx({ workspaceId: demo.id, userId: auth.user.id });
			setReady(true);
		})();

		return () => {
			cancelled = true;
		};
	}, [router]);

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
