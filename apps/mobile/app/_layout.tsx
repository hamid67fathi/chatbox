import { AuthProvider } from "@/context/AuthContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
	return (
		<AuthProvider>
			<StatusBar style="light" />
			<Stack screenOptions={{ headerShown: false }} />
		</AuthProvider>
	);
}
