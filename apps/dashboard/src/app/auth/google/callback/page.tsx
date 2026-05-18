"use client";

import { type AuthData, setAuth } from "@/lib/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
	access_denied: "ورود با Google لغو شد.",
	invalid_state: "نشست OAuth نامعتبر است. دوباره تلاش کنید.",
};

function GoogleCallbackInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState("");

	useEffect(() => {
		const queryError = searchParams.get("error");
		if (queryError) {
			setError(ERROR_MESSAGES[queryError] ?? decodeURIComponent(queryError));
			return;
		}

		const hash = window.location.hash.startsWith("#")
			? window.location.hash.slice(1)
			: "";
		const params = new URLSearchParams(hash);

		if (params.get("requires_2fa") === "1") {
			const pending = params.get("pending_token");
			if (pending) {
				window.history.replaceState(null, "", "/auth/google/callback");
				router.replace(
					`/login?pending_token=${encodeURIComponent(pending)}&from=google`,
				);
				return;
			}
		}

		const accessToken = params.get("access_token");
		const refreshToken = params.get("refresh_token");
		const sessionId = params.get("session_id");
		const userId = params.get("user_id");
		const email = params.get("email");

		if (!accessToken || !refreshToken || !sessionId || !userId || !email) {
			setError("پاسخ OAuth ناقص است.");
			return;
		}

		let workspaces: { id: string; role: string }[] = [];
		try {
			const raw = params.get("workspaces");
			if (raw) workspaces = JSON.parse(raw) as { id: string; role: string }[];
		} catch {
			workspaces = [];
		}

		const auth: AuthData = {
			access_token: accessToken,
			refresh_token: refreshToken,
			session_id: sessionId,
			user: {
				id: userId,
				email,
				full_name: params.get("full_name") || undefined,
				workspaces,
			},
		};
		setAuth(auth);
		window.history.replaceState(null, "", "/auth/google/callback");
		router.replace("/");
	}, [router, searchParams]);

	if (error) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
				<p className="text-sm text-destructive">{error}</p>
				<a href="/login" className="text-sm font-medium text-primary hover:underline">
					بازگشت به ورود
				</a>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<p className="text-sm text-muted-foreground">در حال ورود با Google…</p>
		</div>
	);
}

export default function GoogleCallbackPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center p-4">
					<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
				</div>
			}
		>
			<GoogleCallbackInner />
		</Suspense>
	);
}
