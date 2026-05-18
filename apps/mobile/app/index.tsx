import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
	const { auth, loading } = useAuth();

	if (loading) {
		return (
			<View
				style={{
					flex: 1,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#7c3aed",
				}}
			>
				<ActivityIndicator color="#fff" size="large" />
			</View>
		);
	}

	if (!auth) return <Redirect href="/login" />;
	return <Redirect href="/(app)/inbox" />;
}
