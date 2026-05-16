"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AuthData, setAuth } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function RegisterPage() {
	const router = useRouter();
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const res = await fetch(`${API_URL}/v1/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password, fullName }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data?.error?.message ?? "ثبت‌نام ناموفق بود.");
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

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/80 to-violet-700 p-4">
			<form
				onSubmit={handleSubmit}
				className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-8 shadow-xl"
			>
				<h1 className="text-center text-2xl font-bold">ثبت‌نام در ChatBox</h1>

				{error && (
					<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				)}

				<label className="flex flex-col gap-1.5 text-sm font-medium">
					نام کامل
					<Input
						type="text"
						value={fullName}
						onChange={(e) => setFullName(e.target.value)}
					/>
				</label>

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
					رمز عبور (حداقل ۸ کاراکتر)
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
					{loading ? "لطفاً صبر کنید…" : "ثبت‌نام"}
				</Button>

				<p className="text-center text-sm text-muted-foreground">
					حساب دارید؟{" "}
					<Link href="/login" className="font-semibold text-primary hover:underline">
						وارد شوید
					</Link>
				</p>
			</form>
		</div>
	);
}
