"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message } from "@/lib/api";
import { fetchMessages, sendMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

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
			setMessages((prev) => {
				if (prev.some((m) => m.id === data.message.id)) return prev;
				if (
					prev.some(
						(m) =>
							m.body === data.message.body &&
							m.senderType === data.message.senderType &&
							Math.abs(
								new Date(m.createdAt).getTime() -
									new Date(data.message.createdAt).getTime(),
							) < 5000,
					)
				) {
					return prev.map((m) =>
						m.body === data.message.body &&
						m.senderType === data.message.senderType &&
						!seenRef.current.has(m.id)
							? data.message
							: m,
					);
				}
				return [...prev, data.message];
			});
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
			id: Math.random().toString(36).slice(2) + Date.now().toString(36),
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
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex-1 space-y-3 overflow-y-auto p-4">
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={cn(
							"max-w-[75%] rounded-xl px-3 py-2 text-sm shadow-sm",
							msg.senderType === "ai" &&
								"ms-auto bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100",
							msg.senderType === "agent" &&
								"ms-auto bg-primary text-primary-foreground",
							msg.senderType === "contact" && "me-auto bg-muted text-foreground",
							msg.senderType === "system" &&
								"mx-auto bg-secondary text-center text-xs text-muted-foreground",
						)}
					>
						{(msg.senderType === "ai" || msg.senderType === "agent") && (
							<span className="mb-1 block text-[10px] font-medium opacity-80">
								{msg.senderType === "ai" ? "🤖 AI" : "👤 اپراتور"}
							</span>
						)}
						<div className="whitespace-pre-wrap break-words">{msg.body}</div>
						<div className="mt-1 text-[10px] opacity-70">
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
				className="flex gap-2 border-t border-border bg-card p-4"
				onSubmit={(e) => {
					e.preventDefault();
					handleSend();
				}}
			>
				<Input
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="پیام بنویسید..."
					disabled={sending}
					className="flex-1"
				/>
				<Button type="submit" disabled={!text.trim() || sending}>
					ارسال
				</Button>
			</form>
		</div>
	);
}
