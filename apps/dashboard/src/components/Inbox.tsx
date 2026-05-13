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

	useEffect(() => {
		if (!workspaceId) return;
		fetchConversations(workspaceId).then(setConversations);
	}, [workspaceId]);

	useEffect(() => {
		if (!workspaceId) return;

		const socket = getSocket(workspaceId);

		socket.on("message:new", (data: { message: Message }) => {
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.message.conversationId
						? { ...c, lastMessageAt: data.message.createdAt }
						: c,
				),
			);
		});

		return () => {
			socket.off("message:new");
		};
	}, [workspaceId]);

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
