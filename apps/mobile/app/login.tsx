import { useAuth } from "@/context/AuthContext";
import { login, login2fa } from "@/lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

export default function LoginScreen() {
	const router = useRouter();
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [pendingToken, setPendingToken] = useState<string | null>(null);
	const [totpCode, setTotpCode] = useState("");
	const [useRecovery, setUseRecovery] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState("");

	async function handleLogin() {
		setError("");
		setLoading(true);
		const result = await login(email.trim(), password);
		setLoading(false);
		if (!result.ok) {
			if ("requires2fa" in result && result.requires2fa) {
				setPendingToken(result.pendingToken);
				return;
			}
			setError("error" in result ? result.error : "ورود ناموفق بود.");
			return;
		}
		await signIn(result.auth);
		router.replace("/(app)/inbox");
	}

	async function handle2fa() {
		if (!pendingToken) return;
		setError("");
		setLoading(true);
		const result = await login2fa(
			pendingToken,
			useRecovery ? undefined : totpCode.trim(),
			useRecovery ? recoveryCode.trim() : undefined,
		);
		setLoading(false);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		await signIn(result.auth);
		router.replace("/(app)/inbox");
	}

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<View style={styles.card}>
				<Text style={styles.title}>ChatBox Agent</Text>
				<Text style={styles.subtitle}>ورود اپراتور</Text>

				{error ? <Text style={styles.error}>{error}</Text> : null}

				{pendingToken ? (
					<>
						<Text style={styles.hint}>کد دو مرحله‌ای را وارد کنید.</Text>
						{!useRecovery ? (
							<TextInput
								style={styles.input}
								value={totpCode}
								onChangeText={setTotpCode}
								keyboardType="number-pad"
								maxLength={6}
								placeholder="123456"
								placeholderTextColor="#9ca3af"
							/>
						) : (
							<TextInput
								style={styles.input}
								value={recoveryCode}
								onChangeText={setRecoveryCode}
								placeholder="کد بازیابی"
								placeholderTextColor="#9ca3af"
							/>
						)}
						<Pressable onPress={() => setUseRecovery((v) => !v)}>
							<Text style={styles.link}>
								{useRecovery ? "استفاده از کد ۶ رقمی" : "کد بازیابی"}
							</Text>
						</Pressable>
						<Pressable
							style={styles.button}
							onPress={() => void handle2fa()}
							disabled={loading}
						>
							{loading ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text style={styles.buttonText}>تأیید</Text>
							)}
						</Pressable>
					</>
				) : (
					<>
						<TextInput
							style={styles.input}
							value={email}
							onChangeText={setEmail}
							autoCapitalize="none"
							keyboardType="email-address"
							placeholder="email@example.com"
							placeholderTextColor="#9ca3af"
						/>
						<TextInput
							style={styles.input}
							value={password}
							onChangeText={setPassword}
							secureTextEntry
							placeholder="رمز عبور"
							placeholderTextColor="#9ca3af"
						/>
						<Pressable
							style={styles.button}
							onPress={() => void handleLogin()}
							disabled={loading}
						>
							{loading ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text style={styles.buttonText}>ورود</Text>
							)}
						</Pressable>
					</>
				)}
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: "#7c3aed",
		justifyContent: "center",
		padding: 24,
	},
	card: {
		backgroundColor: "#fff",
		borderRadius: 16,
		padding: 24,
		gap: 12,
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		textAlign: "center",
		color: "#111827",
	},
	subtitle: {
		fontSize: 14,
		textAlign: "center",
		color: "#6b7280",
		marginBottom: 8,
	},
	hint: { fontSize: 13, color: "#6b7280" },
	error: {
		backgroundColor: "#fef2f2",
		color: "#b91c1c",
		padding: 10,
		borderRadius: 8,
		fontSize: 13,
	},
	input: {
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 16,
	},
	button: {
		backgroundColor: "#7c3aed",
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 4,
	},
	buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
	link: { color: "#7c3aed", fontSize: 13, textAlign: "center" },
});
