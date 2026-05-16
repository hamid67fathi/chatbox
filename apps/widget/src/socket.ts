import type { Message } from "./api.js";

type SocketLike = {
	on(event: string, cb: (...args: unknown[]) => void): void;
	emit(event: string, ...args: unknown[]): void;
	disconnect(): void;
	connected: boolean;
};

type IOConnectFn = (url: string, opts: Record<string, unknown>) => SocketLike;

function normalizeMessage(raw: Record<string, unknown>): Message {
	return {
		id: String(raw.id ?? ""),
		body: String(raw.body ?? ""),
		senderType: String(raw.senderType ?? raw.sender_type ?? "system"),
		createdAt: String(
			raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
		),
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
		},
	) {
		this.onMessage = callbacks.onMessage;
		this.onTyping = callbacks.onTyping;

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
