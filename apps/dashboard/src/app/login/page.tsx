"use client";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AuthData, setAuth } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function LoginPageInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [pendingToken, setPendingToken] = useState<string | null>(null);
	const [totpCode, setTotpCode] = useState("");
	const [recoveryCode, setRecoveryCode] = useState("");
	const [useRecovery, setUseRecovery] = useState(false);

	useEffect(() => {
		const token = searchParams.get("pending_token");
		if (token) setPendingToken(token);
	}, [searchParams]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const res = await fetch(`${API_URL}/v1/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data?.error?.message ?? "ورود ناموفق بود.");
				return;
			}
			const data = await res.json();
			if (data.requires_2fa && data.pending_token) {
				setPendingToken(data.pending_token);
				return;
			}
			setAuth(data as AuthData);
			router.push("/");
		} catch {
			setError("خطا در اتصال به سرور.");
		} finally {
			setLoading(false);
		}
	}

	async function handle2fa(e: FormEvent) {
		e.preventDefault();
		if (!pendingToken) return;
		setError("");
		setLoading(true);
		try {
			const res = await fetch(`${API_URL}/v1/auth/login/2fa`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pending_token: pendingToken,
					code: useRecovery ? undefined : totpCode.trim(),
					recovery_code: useRecovery ? recoveryCode.trim() : undefined,
				}),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data?.error?.message ?? "کد نامعتبر است.");
				return;
			}
			const data: AuthData = await res.json();
			setAuth(data);
			router.push("/");
		} catch {
			setError("خطا در اتصال به سرور.");
		} finally {
			setLoading(false);
		}
	}

	if (pendingToken) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/80 to-violet-700 p-4">
				<form
					onSubmit={handle2fa}
					className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-8 shadow-xl"
				>
					<h1 className="text-center text-2xl font-bold">کد دو مرحله‌ای</h1>
					<p className="text-center text-sm text-muted-foreground">
						کد ۶ رقمی از اپ Authenticator را وارد کنید.
					</p>

					{error && (
						<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</p>
					)}

					{!useRecovery ? (
						<label className="flex flex-col gap-1.5 text-sm font-medium">
							کد ۶ رقمی
							<Input
								value={totpCode}
								onChange={(e) => setTotpCode(e.target.value)}
								inputMode="numeric"
								maxLength={6}
								dir="ltr"
								required
							/>
						</label>
					) : (
						<label className="flex flex-col gap-1.5 text-sm font-medium">
							کد بازیابی
							<Input
								value={recoveryCode}
								onChange={(e) => setRecoveryCode(e.target.value)}
								dir="ltr"
								required
							/>
						</label>
					)}

					<Button type="button" variant="ghost" size="sm" onClick={() => setUseRecovery((v) => !v)}>
						{useRecovery ? "استفاده از کد اپ" : "استفاده از کد بازیابی"}
					</Button>

					<Button type="submit" disabled={loading}>
						{loading ? "لطفاً صبر کنید…" : "تأیید و ورود"}
					</Button>

					<Button
						type="button"
						variant="outline"
						onClick={() => {
							setPendingToken(null);
							setTotpCode("");
							setRecoveryCode("");
						}}
					>
						بازگشت
					</Button>
				</form>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/80 to-violet-700 p-4">
			<form
				onSubmit={handleSubmit}
				className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-8 shadow-xl"
			>
				<h1 className="text-center text-2xl font-bold">ورود به ChatBox</h1>

				{error && (
					<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				)}

				<label className="flex flex-col gap-1.5 text-sm font-medium">
					ایمیل
					<Input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						dir="ltr"
					/>
				</label>

				<label className="flex flex-col gap-1.5 text-sm font-medium">
					رمز عبور
					<Input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						minLength={8}
						dir="ltr"
					/>
				</label>

				<Button type="submit" disabled={loading} className="mt-2">
					{loading ? "لطفاً صبر کنید…" : "ورود"}
				</Button>

				<GoogleSignInButton />

				<p className="text-center text-sm text-muted-foreground">
					حساب ندارید؟{" "}
					<Link href="/register" className="font-semibold text-primary hover:underline">
						ثبت‌نام کنید
					</Link>
				</p>
			</form>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-screen items-center justify-center p-4">
					<p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
				</div>
			}
		>
			<LoginPageInner />
		</Suspense>
	);
}
