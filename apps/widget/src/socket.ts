import type { Message } from "./api.js";

type SocketLike = {
	on(event: string, cb: (...args: unknown[]) => void): void;
	emit(event: string, ...args: unknown[]): void;
	disconnect(): void;
	connected: boolean;
};

type IOConnectFn = (url: string, opts: Record<string, unknown>) => SocketLike;

export class WidgetSocket {
	private socket: SocketLike | null = null;
	private onMessage: ((msg: Message) => void) | null = null;
	private onTyping: ((data: { isTyping: boolean }) => void) | null = null;
	private seenIds = new Set<string>();

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
			const d = data as { message: Message };
			if (this.seenIds.has(d.message.id)) return;
			this.seenIds.add(d.message.id);
			this.onMessage?.(d.message);
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
