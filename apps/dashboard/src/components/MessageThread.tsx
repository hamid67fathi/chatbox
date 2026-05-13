"use client";

import type { Message } from "@/lib/api";
import { fetchMessages, sendMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MessageThread.module.css";

interface Props {
	workspaceId: string;
	conversationId: string;
}

export function MessageThread({ workspaceId, conversationId }: Props) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const seenRef = useRef(new Set<string>());

	useEffect(() => {
		seenRef.current.clear();
		fetchMessages(workspaceId, conversationId).then((msgs) => {
			for (const m of msgs) seenRef.current.add(m.id);
			setMessages(msgs);
		});
	}, [workspaceId, conversationId]);

	useEffect(() => {
		const socket = getSocket(workspaceId);

		socket.emit("conv:join", { conv_id: conversationId });

		const handler = (data: { message: Message }) => {
			if (data.message.conversationId !== conversationId) return;
			if (seenRef.current.has(data.message.id)) return;
			seenRef.current.add(data.message.id);
			setMessages((prev) => [...prev, data.message]);
		};

		socket.on("message:new", handler);

		return () => {
			socket.off("message:new", handler);
			socket.emit("conv:leave", { conv_id: conversationId });
		};
	}, [workspaceId, conversationId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	const handleSend = useCallback(async () => {
		const body = text.trim();
		if (!body || sending) return;

		setSending(true);
		setText("");

		const optimistic: Message = {
			id: crypto.randomUUID(),
			conversationId,
			senderType: "agent",
			senderUserId: null,
			senderContactId: null,
			body,
			type: "text",
			createdAt: new Date().toISOString(),
		};
		seenRef.current.add(optimistic.id);
		setMessages((prev) => [...prev, optimistic]);

		try {
			const real = await sendMessage(workspaceId, conversationId, body);
			if (real) {
				seenRef.current.add(real.id);
				setMessages((prev) =>
					prev.map((m) => (m.id === optimistic.id ? real : m)),
				);
			}
		} finally {
			setSending(false);
		}
	}, [text, sending, workspaceId, conversationId]);

	return (
		<div className={styles.thread}>
			<div className={styles.messages}>
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`${styles.bubble} ${
							msg.senderType === "agent"
								? styles.agent
								: msg.senderType === "contact"
									? styles.contact
									: styles.system
						}`}
					>
						<div className={styles.body}>{msg.body}</div>
						<div className={styles.time}>
							{new Date(msg.createdAt).toLocaleTimeString("fa-IR", {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div>
					</div>
				))}
				<div ref={bottomRef} />
			</div>
			<form
				className={styles.inputArea}
				onSubmit={(e) => {
					e.preventDefault();
					handleSend();
				}}
			>
				<input
					className={styles.input}
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="پیام بنویسید..."
					disabled={sending}
				/>
				<button
					type="submit"
					className={styles.send}
					disabled={!text.trim() || sending}
				>
					ارسال
				</button>
			</form>
		</div>
	);
}
