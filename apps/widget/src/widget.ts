import {
	type Message,
	type WidgetConfig,
	createSession,
	fetchMessages,
	sendMessageHttp,
} from "./api.js";
import { WidgetSocket } from "./socket.js";
import { WIDGET_CSS } from "./styles.js";

const CHAT_ICON = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
const CLOSE_ICON = "✕";

export class ChatBoxWidget {
	private config: WidgetConfig;
	private ws: WidgetSocket;
	private root!: ShadowRoot;
	private messagesEl!: HTMLElement;
	private typingEl!: HTMLElement;
	private inputEl!: HTMLInputElement;
	private sendBtn!: HTMLButtonElement;
	private windowEl!: HTMLElement;
	private workspaceId = "";
	private conversationId = "";
	private contactId = "";
	private isOpen = false;

	constructor(config: WidgetConfig) {
		this.config = config;
		this.ws = new WidgetSocket();
	}

	async mount(target?: HTMLElement) {
		const host = document.createElement("div");
		host.id = "chatbox-widget";
		(target ?? document.body).appendChild(host);
		this.root = host.attachShadow({ mode: "open" });

		const style = document.createElement("style");
		style.textContent = WIDGET_CSS;
		this.root.appendChild(style);

		this.root.innerHTML += `
			<div class="cb-container">
				<div class="cb-window" id="cb-window">
					<div class="cb-header">
						<span>پشتیبانی</span>
						<button class="cb-close" id="cb-close">${CLOSE_ICON}</button>
					</div>
					<div class="cb-messages" id="cb-messages"></div>
					<div class="cb-typing" id="cb-typing">در حال نوشتن...</div>
					<div class="cb-input-area">
						<input class="cb-input" id="cb-input" placeholder="پیام بنویسید..." />
						<button class="cb-send" id="cb-send">ارسال</button>
					</div>
				</div>
				<button class="cb-launcher" id="cb-launcher">${CHAT_ICON}</button>
			</div>
		`;

		this.windowEl = this.root.getElementById("cb-window") as HTMLElement;
		this.messagesEl = this.root.getElementById("cb-messages") as HTMLElement;
		this.typingEl = this.root.getElementById("cb-typing") as HTMLElement;
		this.inputEl = this.root.getElementById("cb-input") as HTMLInputElement;
		this.sendBtn = this.root.getElementById("cb-send") as HTMLButtonElement;

		this.root
			.getElementById("cb-launcher")
			?.addEventListener("click", () => this.toggle());
		this.root
			.getElementById("cb-close")
			?.addEventListener("click", () => this.toggle());
		this.sendBtn.addEventListener("click", () => this.send());
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.send();
			}
		});

		await this.initSession();
	}

	private async initSession() {
		try {
			const session = await createSession(this.config);
			this.workspaceId = session.workspace_id;
			this.conversationId = session.conversation_id;
			this.contactId = session.contact_id;

			const msgs = await fetchMessages(
				this.config,
				this.conversationId,
				this.workspaceId,
			);
			for (const msg of msgs) this.appendMessage(msg);

			this.ws.connect(
				this.config.apiUrl,
				this.workspaceId,
				this.conversationId,
				{
					onMessage: (msg) => this.appendMessage(msg),
					onTyping: (data) => {
						this.typingEl.classList.toggle("visible", data.isTyping);
					},
				},
			);
		} catch (err) {
			console.error("[ChatBox] Init failed:", err);
		}
	}

	private toggle() {
		this.isOpen = !this.isOpen;
		this.windowEl.classList.toggle("open", this.isOpen);
		if (this.isOpen) {
			this.scrollToBottom();
			this.inputEl.focus();
		}
	}

	private appendMessage(msg: Message) {
		const div = document.createElement("div");
		div.className = `cb-msg ${msg.senderType}`;
		div.textContent = msg.body;
		this.messagesEl.appendChild(div);
		this.scrollToBottom();
	}

	private scrollToBottom() {
		requestAnimationFrame(() => {
			this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		});
	}

	private async send() {
		const body = this.inputEl.value.trim();
		if (!body) return;

		this.inputEl.value = "";
		this.sendBtn.disabled = true;

		this.appendMessage({
			id: crypto.randomUUID(),
			body,
			senderType: "contact",
			createdAt: new Date().toISOString(),
		});

		try {
			await sendMessageHttp(
				this.config,
				this.conversationId,
				this.workspaceId,
				this.contactId,
				body,
			);
		} catch (err) {
			console.error("[ChatBox] Send failed:", err);
		} finally {
			this.sendBtn.disabled = false;
			this.inputEl.focus();
		}
	}

	destroy() {
		this.ws.disconnect();
		this.root.host.remove();
	}
}
