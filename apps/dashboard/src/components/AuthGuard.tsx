"use client";

import {
	clearAuth,
	getWorkspaceIdFromAuth,
	refreshAuthUser,
} from "@/lib/auth-store";
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

			const wsId = getWorkspaceIdFromAuth();
			if (!wsId) {
				clearAuth();
				router.replace("/login");
				return;
			}

			setCtx({ workspaceId: wsId, userId: auth.user.id });
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
