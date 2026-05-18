import { useAuth } from "@/context/AuthContext";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
	const { auth, loading } = useAuth();

	if (loading) return null;
	if (!auth) return <Redirect href="/login" />;

	return (
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: "#7c3aed" },
				headerTintColor: "#fff",
				headerTitleStyle: { fontWeight: "600" },
			}}
		>
			<Stack.Screen name="inbox" options={{ title: "صندوق ورودی" }} />
			<Stack.Screen name="conversation/[id]" options={{ title: "مکالمه" }} />
		</Stack>
	);
}
