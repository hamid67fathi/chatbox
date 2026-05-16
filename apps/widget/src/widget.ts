import {
	type Message,
	type WidgetConfig,
	type WidgetTheme,
	createSession,
	fetchMessages,
	fetchWidgetTheme,
	sendMessageHttp,
} from "./api.js";
import { WidgetSocket } from "./socket.js";
import { WIDGET_CSS, darkenHex } from "./styles.js";

const CHAT_ICON = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
const CLOSE_ICON = "✕";

const DEFAULT_THEME: WidgetTheme = {
	primary_color: "#2563eb",
	position: "right",
	title: "پشتیبانی",
	welcome_message: "سلام! چطور می‌توانیم کمکتان کنیم؟",
	avatar_url: null,
};

export class ChatBoxWidget {
	private config: WidgetConfig;
	private theme: WidgetTheme = DEFAULT_THEME;
	private ws: WidgetSocket;
	private root!: ShadowRoot;
	private containerEl!: HTMLElement;
	private headerTitleEl!: HTMLElement;
	private headerAvatarEl!: HTMLImageElement | null;
	private welcomeEl!: HTMLElement;
	private messagesEl!: HTMLElement;
	private typingEl!: HTMLElement;
	private inputEl!: HTMLInputElement;
	private sendBtn!: HTMLButtonElement;
	private windowEl!: HTMLElement;
	private workspaceId = "";
	private conversationId = "";
	private isOpen = false;
	private welcomeShown = false;
	private readonly renderedIds = new Set<string>();

	constructor(config: WidgetConfig) {
		this.config = config;
		this.ws = new WidgetSocket();
	}

	async mount(target?: HTMLElement) {
		const theme = await fetchWidgetTheme(this.config);
		if (theme) this.theme = theme;

		const host = document.createElement("div");
		host.id = "chatbox-widget";
		(target ?? document.body).appendChild(host);
		this.root = host.attachShadow({ mode: "open" });

		const style = document.createElement("style");
		style.textContent = WIDGET_CSS;
		this.root.appendChild(style);

		const avatarHtml = this.theme.avatar_url
			? `<img class="cb-avatar" id="cb-avatar" src="" alt="" />`
			: "";

		this.root.innerHTML += `
			<div class="cb-container" id="cb-container">
				<div class="cb-window" id="cb-window">
					<div class="cb-header">
						<div class="cb-header-main">
							${avatarHtml}
							<span id="cb-title">${this.escapeHtml(this.theme.title)}</span>
						</div>
						<button class="cb-close" id="cb-close" type="button">${CLOSE_ICON}</button>
					</div>
					<div class="cb-messages" id="cb-messages">
						<div class="cb-welcome" id="cb-welcome"></div>
					</div>
					<div class="cb-typing" id="cb-typing">در حال نوشتن...</div>
					<div class="cb-input-area">
						<input class="cb-input" id="cb-input" placeholder="پیام بنویسید..." />
						<button class="cb-send" id="cb-send" type="button">ارسال</button>
					</div>
				</div>
				<button class="cb-launcher" id="cb-launcher" type="button" aria-label="باز کردن چت">${CHAT_ICON}</button>
			</div>
		`;

		this.containerEl = this.root.getElementById("cb-container") as HTMLElement;
		this.windowEl = this.root.getElementById("cb-window") as HTMLElement;
		this.headerTitleEl = this.root.getElementById("cb-title") as HTMLElement;
		this.headerAvatarEl = this.root.getElementById(
			"cb-avatar",
		) as HTMLImageElement | null;
		this.welcomeEl = this.root.getElementById("cb-welcome") as HTMLElement;
		this.messagesEl = this.root.getElementById("cb-messages") as HTMLElement;
		this.typingEl = this.root.getElementById("cb-typing") as HTMLElement;
		this.inputEl = this.root.getElementById("cb-input") as HTMLInputElement;
		this.sendBtn = this.root.getElementById("cb-send") as HTMLButtonElement;

		this.applyTheme();

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

	private escapeHtml(text: string) {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	private applyTheme() {
		const hostEl = this.root.host as HTMLElement;
		hostEl.style.setProperty("--cb-primary", this.theme.primary_color);
		hostEl.style.setProperty(
			"--cb-primary-hover",
			darkenHex(this.theme.primary_color),
		);

		if (this.theme.position === "left") {
			this.containerEl.classList.add("cb-pos-left");
		}

		this.headerTitleEl.textContent = this.theme.title;
		this.welcomeEl.textContent = this.theme.welcome_message;

		if (this.headerAvatarEl && this.theme.avatar_url) {
			this.headerAvatarEl.src = this.theme.avatar_url;
			this.headerAvatarEl.alt = this.theme.title;
		}
	}

	private async initSession() {
		try {
			const session = await createSession(this.config);
			this.workspaceId = session.workspace_id;
			this.conversationId = session.conversation_id;

			const msgs = await fetchMessages(this.config);
			if (msgs.length === 0) {
				this.showWelcome();
			} else {
				this.welcomeEl.style.display = "none";
				for (const msg of msgs) {
					if (msg.id) this.renderedIds.add(msg.id);
					this.appendMessage(msg, false);
				}
			}

			this.ws.connect(
				this.config.apiUrl,
				this.workspaceId,
				this.conversationId,
				{
					onMessage: (msg) => {
						this.hideWelcome();
						this.appendMessage(msg);
					},
					onTyping: (data) => {
						this.typingEl.classList.toggle("visible", data.isTyping);
					},
				},
			);
		} catch (err) {
			console.error("[ChatBox] Init failed:", err);
		}
	}

	private showWelcome() {
		if (this.welcomeShown) return;
		this.welcomeShown = true;
		this.welcomeEl.style.display = "block";
	}

	private hideWelcome() {
		this.welcomeEl.style.display = "none";
	}

	private toggle() {
		this.isOpen = !this.isOpen;
		this.windowEl.classList.toggle("open", this.isOpen);
		if (this.isOpen) {
			this.scrollToBottom();
			this.inputEl.focus();
		}
	}

	private appendMessage(msg: Message, scroll = true) {
		if (msg.id) {
			if (this.renderedIds.has(msg.id)) return;
			this.renderedIds.add(msg.id);
		}
		const el = document.createElement("div");
		el.className = `cb-msg ${msg.senderType}`;
		el.textContent = msg.body;
		this.messagesEl.appendChild(el);
		if (scroll) this.scrollToBottom();
	}

	private scrollToBottom() {
		requestAnimationFrame(() => {
			this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		});
	}

	private async send() {
		const body = this.inputEl.value.trim();
		if (!body) return;

		this.hideWelcome();
		this.inputEl.value = "";
		this.sendBtn.disabled = true;

		try {
			const msg = await sendMessageHttp(this.config, body);
			this.appendMessage(msg);
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

