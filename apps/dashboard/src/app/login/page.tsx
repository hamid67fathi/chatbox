"use client";

import { type AuthData, setAuth } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

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
		<div style={styles.wrapper}>
			<form onSubmit={handleSubmit} style={styles.card}>
				<h1 style={styles.title}>ورود به ChatBox</h1>

				{error && <p style={styles.error}>{error}</p>}

				<label style={styles.label}>
					ایمیل
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						style={styles.input}
						dir="ltr"
					/>
				</label>

				<label style={styles.label}>
					رمز عبور
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						minLength={8}
						style={styles.input}
						dir="ltr"
					/>
				</label>

				<button type="submit" disabled={loading} style={styles.button}>
					{loading ? "لطفاً صبر کنید…" : "ورود"}
				</button>

				<p style={styles.link}>
					حساب ندارید؟{" "}
					<a href="/register" style={styles.anchor}>
						ثبت‌نام کنید
					</a>
				</p>
			</form>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	wrapper: {
		minHeight: "100vh",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
	},
	card: {
		background: "#fff",
		borderRadius: 16,
		padding: "40px 32px",
		width: "100%",
		maxWidth: 400,
		boxShadow: "0 20px 60px rgba(0,0,0,.15)",
		display: "flex",
		flexDirection: "column",
		gap: 16,
	},
	title: {
		margin: 0,
		fontSize: 24,
		fontWeight: 700,
		textAlign: "center",
		color: "#1a1a2e",
	},
	error: {
		margin: 0,
		padding: "10px 12px",
		background: "#fee2e2",
		color: "#b91c1c",
		borderRadius: 8,
		fontSize: 14,
	},
	label: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
		fontSize: 14,
		fontWeight: 500,
		color: "#334155",
	},
	input: {
		padding: "10px 12px",
		border: "1px solid #d1d5db",
		borderRadius: 8,
		fontSize: 15,
		outline: "none",
	},
	button: {
		marginTop: 8,
		padding: "12px 0",
		background: "#667eea",
		color: "#fff",
		border: "none",
		borderRadius: 8,
		fontSize: 16,
		fontWeight: 600,
		cursor: "pointer",
	},
	link: {
		textAlign: "center",
		fontSize: 14,
		color: "#64748b",
		margin: 0,
	},
	anchor: {
		color: "#667eea",
		textDecoration: "none",
		fontWeight: 600,
	},
};
