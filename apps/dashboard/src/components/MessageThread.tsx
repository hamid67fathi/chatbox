"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CannedResponsePicker } from "@/components/CannedResponsePicker";
import type { CannedResponse, Message } from "@/lib/api";
import { MessageBody } from "@/components/MessageBody";
import {
	fetchCannedResponses,
	fetchMessages,
	normalizeMessage,
	sendMessage,
	uploadMessageFile,
	useCannedResponse,
} from "@/lib/api";
import {
	defaultCannedVariables,
	resolveCannedByShortcut,
} from "@/lib/canned";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
	workspaceId: string;
	conversationId: string;
	contactName?: string | null;
}

export function MessageThread({ workspaceId, conversationId, contactName }: Props) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [visitorTyping, setVisitorTyping] = useState(false);
	const [replyTo, setReplyTo] = useState<Message | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const seenRef = useRef(new Set<string>());
	const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const markedReadRef = useRef(new Set<string>());
	const [cannedItems, setCannedItems] = useState<CannedResponse[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploadError, setUploadError] = useState("");

	const markAsRead = useCallback(
		(messageId: string) => {
			if (markedReadRef.current.has(messageId)) return;
			markedReadRef.current.add(messageId);
			getSocket(workspaceId).emit("message:read", {
				conv_id: conversationId,
				message_id: messageId,
			});
			setMessages((prev) =>
				prev.map((m) =>
					m.id === messageId ? { ...m, readAt: new Date().toISOString() } : m,
				),
			);
		},
		[workspaceId, conversationId],
	);

	const markContactMessagesRead = useCallback(
		(msgs: Message[]) => {
			for (const m of msgs) {
				if (m.senderType === "contact" && !m.readAt) {
					markAsRead(m.id);
				}
			}
		},
		[markAsRead],
	);

	useEffect(() => {
		fetchCannedResponses(workspaceId).then(setCannedItems);
	}, [workspaceId]);

	useEffect(() => {
		seenRef.current.clear();
		markedReadRef.current.clear();
		setVisitorTyping(false);
		setReplyTo(null);
		fetchMessages(workspaceId, conversationId).then((msgs) => {
			for (const m of msgs) seenRef.current.add(m.id);
			setMessages(msgs);
			markContactMessagesRead(msgs);
		});
	}, [workspaceId, conversationId, markContactMessagesRead]);

	useEffect(() => {
		const socket = getSocket(workspaceId);

		socket.emit("conv:join", { conv_id: conversationId });

		const onMessage = (data: { message: Message }) => {
			const msg = normalizeMessage(
				(data.message ?? data) as unknown as Record<string, unknown>,
			);
			if (msg.conversationId !== conversationId) return;
			if (seenRef.current.has(msg.id)) return;
			seenRef.current.add(msg.id);
			setMessages((prev) => {
				if (prev.some((m) => m.id === msg.id)) return prev;
				if (
					prev.some(
						(m) =>
							m.body === msg.body &&
							m.senderType === msg.senderType &&
							Math.abs(
								new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime(),
							) < 5000,
					)
				) {
					return prev.map((m) =>
						m.body === msg.body &&
						m.senderType === msg.senderType &&
						!seenRef.current.has(m.id)
							? msg
							: m,
					);
				}
				return [...prev, msg];
			});
			if (msg.senderType === "contact") {
				markAsRead(msg.id);
			}
		};

		const onTyping = (data: {
			conv_id?: string;
			isTyping?: boolean;
			is_typing?: boolean;
		}) => {
			if (data.conv_id && data.conv_id !== conversationId) return;
			setVisitorTyping(Boolean(data.isTyping ?? data.is_typing));
		};

		const onRead = (data: { message_id: string }) => {
			setMessages((prev) =>
				prev.map((m) =>
					m.id === data.message_id
						? { ...m, readAt: m.readAt ?? new Date().toISOString() }
						: m,
				),
			);
		};

		socket.on("message:new", onMessage);
		socket.on("typing", onTyping);
		socket.on("message:read", onRead);

		return () => {
			socket.off("message:new", onMessage);
			socket.off("typing", onTyping);
			socket.off("message:read", onRead);
			socket.emit("conv:leave", { conv_id: conversationId });
			socket.emit("typing:stop", { conv_id: conversationId });
		};
	}, [workspaceId, conversationId, markAsRead]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	const emitTyping = useCallback(
		(isTyping: boolean) => {
			getSocket(workspaceId).emit(isTyping ? "typing:start" : "typing:stop", {
				conv_id: conversationId,
			});
		},
		[workspaceId, conversationId],
	);

	const handleInputChange = useCallback(
		(value: string) => {
			setText(value);
			if (!value.trim()) {
				emitTyping(false);
				return;
			}
			emitTyping(true);
			if (typingStopRef.current) clearTimeout(typingStopRef.current);
			typingStopRef.current = setTimeout(() => emitTyping(false), 2000);
		},
		[emitTyping],
	);

	const handleFilePick = useCallback(
		async (file: File) => {
			setUploadError("");
			setSending(true);
			try {
				const { attachment, error } = await uploadMessageFile(workspaceId, file);
				if (error || !attachment) {
					setUploadError(error ?? "آپلود ناموفق بود.");
					return;
				}
				const caption = text.trim();
				const real = await sendMessage(
					workspaceId,
					conversationId,
					caption || attachment.name,
					replyTo?.id ?? null,
					{
						type: attachment.type,
						attachments: [attachment],
					},
				);
				if (real) {
					seenRef.current.add(real.id);
					setMessages((prev) => [...prev, real]);
					setText("");
					setReplyTo(null);
				}
			} finally {
				setSending(false);
				if (fileInputRef.current) fileInputRef.current.value = "";
			}
		},
		[workspaceId, conversationId, text, replyTo],
	);

	const handleSend = useCallback(async () => {
		let body = text.trim();
		if (!body || sending) return;

		const vars = defaultCannedVariables(contactName);
		const resolved = resolveCannedByShortcut(body, cannedItems, vars);
		let usedCannedId: string | null = null;
		if (resolved) {
			body = resolved.body;
			usedCannedId = resolved.item.id;
		}

		emitTyping(false);
		const replyToId = replyTo?.id ?? null;
		setSending(true);
		setText("");
		setReplyTo(null);

		const optimistic: Message = {
			id: Math.random().toString(36).slice(2) + Date.now().toString(36),
			conversationId,
			senderType: "agent",
			senderUserId: null,
			senderContactId: null,
			body,
			type: "text",
			createdAt: new Date().toISOString(),
			readAt: null,
			replyToId,
		};
		seenRef.current.add(optimistic.id);
		setMessages((prev) => [...prev, optimistic]);

		try {
			if (usedCannedId) {
				void useCannedResponse(workspaceId, usedCannedId, vars);
			}
			const real = await sendMessage(workspaceId, conversationId, body, replyToId);
			if (real) {
				seenRef.current.add(real.id);
				setMessages((prev) =>
					prev.map((m) => (m.id === optimistic.id ? real : m)),
				);
			}
		} finally {
			setSending(false);
		}
	}, [
		text,
		sending,
		workspaceId,
		conversationId,
		emitTyping,
		replyTo,
		cannedItems,
		contactName,
	]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex-1 space-y-3 overflow-y-auto p-4">
				{messages.map((msg) => {
					const quoted = msg.replyToId
						? messages.find((m) => m.id === msg.replyToId)
						: null;
					return (
					<div
						key={msg.id}
						className={cn(
							"group relative max-w-[75%] rounded-xl px-3 py-2 text-sm shadow-sm",
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
						{quoted && (
							<div className="mb-1 border-s-2 border-current/30 ps-2 text-xs opacity-80">
								{quoted.body.slice(0, 120)}
								{quoted.body.length > 120 ? "…" : ""}
							</div>
						)}
						<MessageBody msg={msg} />
						<button
							type="button"
							className="absolute -top-2 end-0 hidden rounded bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground shadow group-hover:block"
							onClick={() => setReplyTo(msg)}
						>
							پاسخ
						</button>
						<div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
							<span>
								{new Date(msg.createdAt).toLocaleTimeString("fa-IR", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
							{msg.senderType === "agent" && (
								<span title={msg.readAt ? "خوانده شد" : "ارسال شد"}>
									{msg.readAt ? "✓✓" : "✓"}
								</span>
							)}
						</div>
					</div>
					);
				})}
				{visitorTyping && (
					<p className="text-xs text-muted-foreground">بازدیدکننده در حال نوشتن…</p>
				)}
				<div ref={bottomRef} />
			</div>
			{replyTo && (
				<div className="flex items-center justify-between gap-2 border-t border-border bg-muted/50 px-4 py-2 text-xs">
					<span className="truncate">
						پاسخ به: {replyTo.body.slice(0, 80)}
						{replyTo.body.length > 80 ? "…" : ""}
					</span>
					<button
						type="button"
						className="shrink-0 text-muted-foreground hover:text-foreground"
						onClick={() => setReplyTo(null)}
					>
						✕
					</button>
				</div>
			)}
			{uploadError && (
				<p className="px-4 pb-1 text-xs text-destructive">{uploadError}</p>
			)}
			<form
				className="relative flex gap-2 border-t border-border bg-card p-4"
				onSubmit={(e) => {
					e.preventDefault();
					handleSend();
				}}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain"
					className="hidden"
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) void handleFilePick(f);
					}}
				/>
				<Button
					type="button"
					variant="outline"
					disabled={sending}
					onClick={() => fileInputRef.current?.click()}
					title="پیوست فایل"
				>
					📎
				</Button>
				<div className="relative min-w-0 flex-1">
					{text.startsWith("/") && (
						<CannedResponsePicker
							items={cannedItems}
							query={text}
							contactName={contactName}
							onSelect={(expanded, item) => {
								setText(expanded);
								void useCannedResponse(
									workspaceId,
									item.id,
									defaultCannedVariables(contactName),
								);
							}}
						/>
					)}
					<Input
						value={text}
						onChange={(e) => handleInputChange(e.target.value)}
						placeholder="پیام بنویسید… (/greet برای پاسخ آماده)"
						disabled={sending}
						className="w-full"
					/>
				</div>
				<Button type="submit" disabled={!text.trim() || sending}>
					ارسال
				</Button>
			</form>
		</div>
	);
}
