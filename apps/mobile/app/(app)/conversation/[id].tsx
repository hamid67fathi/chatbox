import { useAuth } from "@/context/AuthContext";
import { fetchMessages, sendMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Message } from "@/lib/types";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

export default function ConversationScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { auth, workspaceId } = useAuth();
	const [messages, setMessages] = useState<Message[]>([]);
	const [draft, setDraft] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const listRef = useRef<FlatList<Message>>(null);

	const load = useCallback(async () => {
		if (!workspaceId || !id) return;
		const data = await fetchMessages(workspaceId, id);
		setMessages(data);
	}, [workspaceId, id]);

	useEffect(() => {
		void (async () => {
			setLoading(true);
			await load();
			setLoading(false);
		})();
	}, [load]);

	useEffect(() => {
		if (!workspaceId || !auth?.user.id || !id) return;

		void (async () => {
			const socket = await getSocket(workspaceId, auth.user.id);
			const onMessage = (payload: { conversation_id?: string; conversationId?: string }) => {
				const cid = payload.conversation_id ?? payload.conversationId;
				if (cid === id) void load();
			};
			socket.on("message:new", onMessage);
		})();
	}, [workspaceId, auth?.user.id, id, load]);

	async function handleSend() {
		const body = draft.trim();
		if (!body || !workspaceId || !id || sending) return;
		setSending(true);
		const msg = await sendMessage(workspaceId, id, body);
		setSending(false);
		if (msg) {
			setDraft("");
			setMessages((prev) => [...prev, msg]);
			setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
		}
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color="#7c3aed" size="large" />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			keyboardVerticalOffset={88}
		>
			<FlatList
				ref={listRef}
				data={messages}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
				renderItem={({ item }) => {
					const isAgent = item.senderType === "agent";
					return (
						<View
							style={[
								styles.bubble,
								isAgent ? styles.bubbleAgent : styles.bubbleVisitor,
							]}
						>
							<Text
								style={[
									styles.bubbleText,
									isAgent ? styles.bubbleTextAgent : styles.bubbleTextVisitor,
								]}
							>
								{item.body}
							</Text>
						</View>
					);
				}}
			/>
			<View style={styles.composer}>
				<TextInput
					style={styles.input}
					value={draft}
					onChangeText={setDraft}
					placeholder="پیام…"
					placeholderTextColor="#9ca3af"
					multiline
				/>
				<Pressable
					style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
					onPress={() => void handleSend()}
					disabled={sending}
				>
					<Text style={styles.sendBtnText}>{sending ? "…" : "ارسال"}</Text>
				</Pressable>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: "#f3f4f6" },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	list: { padding: 12, gap: 8, flexGrow: 1 },
	bubble: {
		maxWidth: "85%",
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 16,
		marginBottom: 8,
	},
	bubbleAgent: {
		alignSelf: "flex-end",
		backgroundColor: "#7c3aed",
	},
	bubbleVisitor: {
		alignSelf: "flex-start",
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#e5e7eb",
	},
	bubbleText: { fontSize: 15, lineHeight: 22 },
	bubbleTextAgent: { color: "#fff" },
	bubbleTextVisitor: { color: "#111827" },
	composer: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 8,
		padding: 12,
		backgroundColor: "#fff",
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
	},
	input: {
		flex: 1,
		minHeight: 44,
		maxHeight: 120,
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 16,
	},
	sendBtn: {
		backgroundColor: "#7c3aed",
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	sendBtnDisabled: { opacity: 0.6 },
	sendBtnText: { color: "#fff", fontWeight: "600" },
});
