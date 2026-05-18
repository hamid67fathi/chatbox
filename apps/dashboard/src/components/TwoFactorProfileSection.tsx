"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	disableTwoFactor,
	fetchTwoFactorStatus,
	setupTwoFactor,
	verifyTwoFactorSetup,
} from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

export function TwoFactorProfileSection() {
	const [enabled, setEnabled] = useState(false);
	const [hasPassword, setHasPassword] = useState(true);
	const [loading, setLoading] = useState(true);
	const [setupQr, setSetupQr] = useState<string | null>(null);
	const [setupSecret, setSetupSecret] = useState("");
	const [verifyCode, setVerifyCode] = useState("");
	const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
	const [disableCode, setDisableCode] = useState("");
	const [disablePassword, setDisablePassword] = useState("");
	const [msg, setMsg] = useState("");
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		const status = await fetchTwoFactorStatus();
		if (status) {
			setEnabled(status.enabled);
			setHasPassword(status.has_password);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function startSetup() {
		setError("");
		setMsg("");
		setRecoveryCodes(null);
		const result = await setupTwoFactor();
		if (!result) {
			setError("شروع راه‌اندازی 2FA ناموفق بود.");
			return;
		}
		setSetupQr(result.qr_data_url);
		setSetupSecret(result.secret);
		setVerifyCode("");
	}

	async function confirmSetup(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const result = await verifyTwoFactorSetup(verifyCode.trim());
		if (!result) {
			setError("کد تأیید نامعتبر است.");
			return;
		}
		setSetupQr(null);
		setSetupSecret("");
		setRecoveryCodes(result.recovery_codes ?? []);
		setEnabled(true);
		setMsg("احراز هویت دو مرحله‌ای فعال شد. کدهای بازیابی را ذخیره کنید.");
	}

	async function handleDisable(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		const ok = await disableTwoFactor({
			code: disableCode.trim() || undefined,
			password: disablePassword || undefined,
		});
		if (!ok) {
			setError("غیرفعال‌سازی ناموفق بود. کد و رمز را بررسی کنید.");
			return;
		}
		setDisableCode("");
		setDisablePassword("");
		setEnabled(false);
		setMsg("2FA غیرفعال شد.");
	}

	if (loading) {
		return (
			<p className="text-sm text-muted-foreground">در حال بارگذاری 2FA…</p>
		);
	}

	return (
		<div className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
			<p className="text-sm font-medium">احراز هویت دو مرحله‌ای (2FA)</p>
			<p className="text-sm text-muted-foreground">
				با Google Authenticator یا Authy. هنگام ورود کد ۶ رقمی لازم است.
			</p>

			{error && (
				<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			)}
			{msg && (
				<p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
					{msg}
				</p>
			)}

			{recoveryCodes && recoveryCodes.length > 0 && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
					<p className="mb-2 text-sm font-medium">کدهای بازیابی (یک‌بار نمایش)</p>
					<ul className="grid grid-cols-2 gap-1 font-mono text-xs" dir="ltr">
						{recoveryCodes.map((c) => (
							<li key={c}>{c}</li>
						))}
					</ul>
				</div>
			)}

			{!enabled && !setupQr && (
				<Button type="button" variant="outline" onClick={() => void startSetup()}>
					فعال‌سازی 2FA
				</Button>
			)}

			{setupQr && (
				<form onSubmit={confirmSetup} className="flex flex-col gap-3">
					<img
						src={setupQr}
						alt="QR code for authenticator"
						className="mx-auto h-44 w-44 rounded-md border border-border bg-white p-2"
					/>
					<p className="text-center font-mono text-xs text-muted-foreground" dir="ltr">
						{setupSecret}
					</p>
					<label className="flex flex-col gap-1 text-sm font-medium">
						کد ۶ رقمی از اپ
						<Input
							value={verifyCode}
							onChange={(e) => setVerifyCode(e.target.value)}
							inputMode="numeric"
							pattern="[0-9]{6}"
							maxLength={6}
							dir="ltr"
							required
						/>
					</label>
					<Button type="submit">تأیید و فعال‌سازی</Button>
				</form>
			)}

			{enabled && (
				<form onSubmit={handleDisable} className="flex flex-col gap-3">
					<label className="flex flex-col gap-1 text-sm font-medium">
						کد فعلی برای غیرفعال‌سازی
						<Input
							value={disableCode}
							onChange={(e) => setDisableCode(e.target.value)}
							inputMode="numeric"
							maxLength={6}
							dir="ltr"
							required
						/>
					</label>
					{hasPassword && (
						<label className="flex flex-col gap-1 text-sm font-medium">
							رمز عبور
							<Input
								type="password"
								value={disablePassword}
								onChange={(e) => setDisablePassword(e.target.value)}
								dir="ltr"
								required
							/>
						</label>
					)}
					<Button type="submit" variant="destructive">
						غیرفعال‌سازی 2FA
					</Button>
				</form>
			)}
		</div>
	);
}
