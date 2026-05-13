"use client";

import { clearAuth, getAuth, getWorkspaceIdFromAuth } from "@/lib/auth-store";
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
		const auth = getAuth();
		if (!auth?.access_token) {
			router.replace("/login");
			return;
		}

		const wsId =
			getWorkspaceIdFromAuth() ??
			(process.env.NEXT_PUBLIC_WORKSPACE_ID || "");

		if (!wsId) {
			clearAuth();
			router.replace("/login");
			return;
		}

		setCtx({ workspaceId: wsId, userId: auth.user.id });
		setReady(true);
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
