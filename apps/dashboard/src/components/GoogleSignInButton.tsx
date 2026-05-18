"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function GoogleSignInButton() {
	const [configured, setConfigured] = useState(false);

	useEffect(() => {
		void fetch(`${API_URL}/v1/auth/google/status`)
			.then((r) => (r.ok ? r.json() : null))
			.then((json: { configured?: boolean } | null) => {
				setConfigured(Boolean(json?.configured));
			})
			.catch(() => setConfigured(false));
	}, []);

	if (!configured) return null;

	return (
		<>
			<div className="relative my-2">
				<div className="absolute inset-0 flex items-center">
					<span className="w-full border-t border-border" />
				</div>
				<span className="relative mx-auto block w-fit bg-card px-2 text-xs text-muted-foreground">
					یا
				</span>
			</div>
			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={() => {
					window.location.href = `${API_URL}/v1/auth/google`;
				}}
			>
				ورود با Google
			</Button>
		</>
	);
}
