import { useAuth } from "@/context/AuthContext";
import { fetchConversations } from "@/lib/api";
import { disconnectSocket, getSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/types";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";

function conversationTitle(c: Conversation): string {
	const name = c.contact?.fullName?.trim();
	if (name) return name;
	if (c.subject?.trim()) return c.subject.trim();
	return `مکالمه ${c.channel}`;
}

export default function InboxScreen() {
	const router = useRouter();
	const { auth, workspaceId, signOut } = useAuth();
	const [rows, setRows] = useState<Conversation[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		if (!workspaceId) return;
		const data = await fetchConversations(workspaceId);
		setRows(data);
	}, [workspaceId]);

	useEffect(() => {
		void (async () => {
			setLoading(true);
			await load();
			setLoading(false);
		})();
	}, [load]);

	useEffect(() => {
		if (!workspaceId || !auth?.user.id) return;

		void (async () => {
			const socket = await getSocket(workspaceId, auth.user.id);
			const onMessage = () => {
				void load();
			};
			const onConv = () => {
				void load();
			};
			socket.on("message:new", onMessage);
			socket.on("conversation:new", onConv);
		})();

		return () => {
			disconnectSocket();
		};
	}, [workspaceId, auth?.user.id, load]);

	async function onRefresh() {
		setRefreshing(true);
		await load();
		setRefreshing(false);
	}

	if (!workspaceId) {
		return (
			<View style={styles.center}>
				<Text>ورک‌اسپیس یافت نشد.</Text>
			</View>
		);
	}

	return (
		<View style={styles.root}>
			<View style={styles.topBar}>
				<Text style={styles.email} numberOfLines={1}>
					{auth?.user.email}
				</Text>
				<Pressable onPress={() => void signOut().then(() => router.replace("/login"))}>
					<Text style={styles.logout}>خروج</Text>
				</Pressable>
			</View>

			{loading ? (
				<ActivityIndicator style={styles.loader} color="#7c3aed" />
			) : (
				<FlatList
					data={rows}
					keyExtractor={(item) => item.id}
					refreshControl={
						<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
					}
					ListEmptyComponent={
						<Text style={styles.empty}>مکالمه‌ای نیست.</Text>
					}
					renderItem={({ item }) => (
						<Pressable
							style={styles.row}
							onPress={() =>
								router.push({
									pathname: "/(app)/conversation/[id]",
									params: { id: item.id },
								})
							}
						>
							<Text style={styles.rowTitle}>{conversationTitle(item)}</Text>
							<Text style={styles.rowMeta}>
								{item.status} · {item.channel}
							</Text>
						</Pressable>
					)}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: "#f9fafb" },
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 10,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
	},
	email: { flex: 1, fontSize: 13, color: "#374151" },
	logout: { color: "#7c3aed", fontWeight: "600", fontSize: 14 },
	loader: { marginTop: 40 },
	empty: { textAlign: "center", marginTop: 40, color: "#6b7280" },
	row: {
		backgroundColor: "#fff",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6",
	},
	rowTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
	rowMeta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
