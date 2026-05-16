import type { Message } from "./api.js";

type SocketLike = {
	on(event: string, cb: (...args: unknown[]) => void): void;
	emit(event: string, ...args: unknown[]): void;
	disconnect(): void;
	connected: boolean;
};

type IOConnectFn = (url: string, opts: Record<string, unknown>) => SocketLike;

function normalizeMessage(raw: Record<string, unknown>): Message {
	const attachments = raw.attachments;
	let parsed: Message["attachments"] = null;
	if (Array.isArray(attachments)) {
		parsed = attachments
			.filter((a) => a && typeof a === "object" && typeof (a as { url?: string }).url === "string")
			.map((a) => {
				const o = a as Record<string, unknown>;
				return {
					url: String(o.url),
					name: String(o.name ?? "file"),
					mime_type: String(o.mime_type ?? ""),
					size_bytes: Number(o.size_bytes ?? 0),
					type: o.type === "image" ? "image" : "file",
				};
			});
	}
	return {
		id: String(raw.id ?? ""),
		body: String(raw.body ?? ""),
		senderType: String(raw.senderType ?? raw.sender_type ?? "system"),
		type: String(raw.type ?? "text"),
		attachments: parsed && parsed.length > 0 ? parsed : null,
		createdAt: String(
			raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
		),
		readAt: (raw.readAt ?? raw.read_at ?? null) as string | null,
		deliveredAt: (raw.deliveredAt ?? raw.delivered_at ?? null) as string | null,
	};
}

export class WidgetSocket {
	private socket: SocketLike | null = null;
	private onMessage: ((msg: Message) => void) | null = null;
	private onTyping: ((data: { isTyping: boolean }) => void) | null = null;

	connect(
		apiUrl: string,
		workspaceId: string,
		conversationId: string,
		callbacks: {
			onMessage: (msg: Message) => void;
			onTyping: (data: { isTyping: boolean }) => void;
			onRead?: (data: { message_id: string }) => void;
		},
	) {
		this.onMessage = callbacks.onMessage;
		this.onTyping = callbacks.onTyping;
		const onRead = callbacks.onRead;

		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}

		const ioConnect = (globalThis as unknown as { io?: IOConnectFn }).io;
		if (!ioConnect) {
			console.warn("[ChatBox] socket.io-client not loaded, WS disabled");
			return;
		}

		this.socket = ioConnect(apiUrl, {
			query: { workspace_id: workspaceId, token: "visitor" },
		});

		this.socket.on("connected", () => {
			this.socket?.emit("conv:join", { conv_id: conversationId });
		});

		this.socket.on("message:new", (data: unknown) => {
			const payload = data as { message?: Record<string, unknown> };
			const raw = payload.message ?? (data as Record<string, unknown>);
			if (!raw?.id) return;
			this.onMessage?.(normalizeMessage(raw));
		});

		this.socket.on("typing", (data: unknown) => {
			this.onTyping?.(data as { isTyping: boolean });
		});

		this.socket.on("message:read", (data: unknown) => {
			const d = data as { message_id?: string };
			if (d.message_id) onRead?.({ message_id: d.message_id });
		});
	}

	markRead(convId: string, messageId: string) {
		this.socket?.emit("message:read", {
			conv_id: convId,
			message_id: messageId,
		});
	}

	emitTyping(convId: string, isTyping: boolean) {
		this.socket?.emit(isTyping ? "typing:start" : "typing:stop", {
			conv_id: convId,
		});
	}

	disconnect() {
		this.socket?.disconnect();
	}
}
