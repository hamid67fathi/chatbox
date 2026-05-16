"use client";

import type { Conversation, Message } from "@/lib/api";
import { fetchConversations } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useCallback, useEffect, useState } from "react";
import { ConversationList } from "./ConversationList";
import styles from "./Inbox.module.css";
import { MessageThread } from "./MessageThread";

interface Props {
	workspaceId: string;
}

export function Inbox({ workspaceId }: Props) {
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);

	const reloadConversations = useCallback(() => {
		if (!workspaceId) return;
		fetchConversations(workspaceId).then(setConversations);
	}, [workspaceId]);

	useEffect(() => {
		reloadConversations();
	}, [reloadConversations]);

	useEffect(() => {
		if (!workspaceId) return;
		const interval = setInterval(reloadConversations, 8000);
		return () => clearInterval(interval);
	}, [workspaceId, reloadConversations]);

	useEffect(() => {
		if (!workspaceId) return;

		const socket = getSocket(workspaceId);

		const onConnected = () => {
			reloadConversations();
		};

		const onConversationNew = (data: { conversation: Conversation }) => {
			setConversations((prev) => {
				if (prev.some((c) => c.id === data.conversation.id)) return prev;
				return [data.conversation, ...prev];
			});
		};

		const onMessageNew = (data: { message: Message }) => {
			const convId = data.message.conversationId;
			setConversations((prev) => {
				const idx = prev.findIndex((c) => c.id === convId);
				if (idx === -1) {
					reloadConversations();
					return prev;
				}
				const next = [...prev];
				next[idx] = { ...next[idx], lastMessageAt: data.message.createdAt };
				next.sort(
					(a, b) =>
						new Date(b.lastMessageAt ?? b.createdAt).getTime() -
						new Date(a.lastMessageAt ?? a.createdAt).getTime(),
				);
				return next;
			});
		};

		const onNeedsHuman = (data: { conversation_id: string }) => {
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.conversation_id ? { ...c, needsHuman: true } : c,
				),
			);
		};

		socket.on("connected", onConnected);
		socket.on("conversation:new", onConversationNew);
		socket.on("message:new", onMessageNew);
		socket.on("conv:needs_human", onNeedsHuman);

		if (socket.connected) onConnected();

		return () => {
			socket.off("connected", onConnected);
			socket.off("conversation:new", onConversationNew);
			socket.off("message:new", onMessageNew);
			socket.off("conv:needs_human", onNeedsHuman);
		};
	}, [workspaceId, reloadConversations]);

	const handleSelect = useCallback((id: string) => {
		setActiveId(id);
	}, []);

	if (!workspaceId) {
		return (
			<div className={styles.empty}>
				<p>
					متغیر <code>NEXT_PUBLIC_WORKSPACE_ID</code> تنظیم نشده.
				</p>
			</div>
		);
	}

	return (
		<div className={styles.inbox}>
			<aside className={styles.sidebar}>
				<div className={styles.sidebarHeader}>
					<h1>📥 صندوق ورودی</h1>
				</div>
				<ConversationList
					conversations={conversations}
					activeId={activeId}
					onSelect={handleSelect}
				/>
			</aside>
			<main className={styles.main}>
				{activeId ? (
					<MessageThread workspaceId={workspaceId} conversationId={activeId} />
				) : (
					<div className={styles.placeholder}>
						<p>یک مکالمه را انتخاب کنید</p>
					</div>
				)}
			</main>
		</div>
	);
}
