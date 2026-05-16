import {
	type Message,
	type PrechatFieldConfig,
	type WidgetConfig,
	type SessionResponse,
	type WidgetTheme,
	attachmentFullUrl,
	createSession,
	fetchMessages,
	fetchWidgetTheme,
	sendMessageHttp,
	setApiBaseUrl,
	updateContactProfile,
	uploadWidgetFile,
} from "./api.js";
import { WidgetSocket } from "./socket.js";
import { WIDGET_CSS, darkenHex } from "./styles.js";

const CHAT_ICON = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
const CLOSE_ICON = "✕";

const DEFAULT_PRECHAT = {
	enabled: false,
	fields: {
		name: { enabled: true, required: true },
		email: { enabled: true, required: false },
		phone: { enabled: false, required: false },
	},
};

const DEFAULT_THEME: WidgetTheme = {
	primary_color: "#2563eb",
	position: "right",
	title: "پشتیبانی",
	welcome_message: "سلام! چطور می‌توانیم کمکتان کنیم؟",
	avatar_url: null,
	prechat: DEFAULT_PRECHAT,
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
	private prechatEl!: HTMLElement;
	private prechatFormEl!: HTMLFormElement;
	private prechatErrorEl!: HTMLElement;
	private typingEl!: HTMLElement;
	private inputAreaEl!: HTMLElement;
	private fileInputEl!: HTMLInputElement;
	private inputEl!: HTMLInputElement;
	private sendBtn!: HTMLButtonElement;
	private windowEl!: HTMLElement;
	private workspaceId = "";
	private conversationId = "";
	private isOpen = false;
	private welcomeShown = false;
	private chatStarted = false;
	private readonly renderedIds = new Set<string>();

	constructor(config: WidgetConfig) {
		this.config = config;
		this.ws = new WidgetSocket();
		setApiBaseUrl(config.apiUrl);
	}

	async mount(target?: HTMLElement) {
		const theme = await fetchWidgetTheme(this.config);
		if (theme) this.theme = { ...DEFAULT_THEME, ...theme, prechat: theme.prechat ?? DEFAULT_PRECHAT };

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
					<div class="cb-prechat" id="cb-prechat">
						<p class="cb-prechat-title">قبل از شروع گفتگو</p>
						<p class="cb-prechat-desc">لطفاً اطلاعات زیر را وارد کنید.</p>
						<form id="cb-prechat-form"></form>
						<p class="cb-prechat-error" id="cb-prechat-error"></p>
					</div>
					<div class="cb-messages" id="cb-messages">
						<div class="cb-welcome" id="cb-welcome"></div>
					</div>
					<div class="cb-typing" id="cb-typing">در حال نوشتن...</div>
					<div class="cb-input-area" id="cb-input-area">
						<input type="file" id="cb-file" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain" />
						<button type="button" class="cb-attach" id="cb-attach" title="پیوست">📎</button>
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
		this.prechatEl = this.root.getElementById("cb-prechat") as HTMLElement;
		this.prechatFormEl = this.root.getElementById(
			"cb-prechat-form",
		) as HTMLFormElement;
		this.prechatErrorEl = this.root.getElementById(
			"cb-prechat-error",
		) as HTMLElement;
		this.welcomeEl = this.root.getElementById("cb-welcome") as HTMLElement;
		this.messagesEl = this.root.getElementById("cb-messages") as HTMLElement;
		this.typingEl = this.root.getElementById("cb-typing") as HTMLElement;
		this.inputAreaEl = this.root.getElementById("cb-input-area") as HTMLElement;
		this.fileInputEl = this.root.getElementById("cb-file") as HTMLInputElement;
		this.inputEl = this.root.getElementById("cb-input") as HTMLInputElement;
		this.sendBtn = this.root.getElementById("cb-send") as HTMLButtonElement;

		this.buildPrechatForm();
		this.applyTheme();

		this.root
			.getElementById("cb-launcher")
			?.addEventListener("click", () => this.toggle());
		this.root
			.getElementById("cb-close")
			?.addEventListener("click", () => this.toggle());
		this.sendBtn.addEventListener("click", () => this.send());
		this.root.getElementById("cb-attach")?.addEventListener("click", () => {
			this.fileInputEl.click();
		});
		this.fileInputEl.addEventListener("change", () => {
			const f = this.fileInputEl.files?.[0];
			if (f) void this.sendFile(f);
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.send();
			}
		});
		this.prechatFormEl.addEventListener("submit", (e) => {
			e.preventDefault();
			void this.submitPrechat();
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

	private prechatFields() {
		return this.theme.prechat ?? DEFAULT_PRECHAT;
	}

	private buildPrechatForm() {
		const pc = this.prechatFields();
		const fields: Array<{
			key: "name" | "email" | "phone";
			cfg: PrechatFieldConfig;
			label: string;
			type: string;
			id: string;
		}> = [
			{ key: "name", cfg: pc.fields.name, label: "نام", type: "text", id: "cb-pc-name" },
			{
				key: "email",
				cfg: pc.fields.email,
				label: "ایمیل",
				type: "email",
				id: "cb-pc-email",
			},
			{
				key: "phone",
				cfg: pc.fields.phone,
				label: "تلفن",
				type: "tel",
				id: "cb-pc-phone",
			},
		];

		this.prechatFormEl.innerHTML = "";
		for (const f of fields) {
			if (!f.cfg.enabled) continue;
			const label = document.createElement("label");
			label.htmlFor = f.id;
			label.textContent = f.cfg.required ? `${f.label} *` : f.label;
			const input = document.createElement("input");
			input.id = f.id;
			input.name = f.key;
			input.type = f.type;
			input.required = f.cfg.required;
			label.appendChild(input);
			this.prechatFormEl.appendChild(label);
		}

		const btn = document.createElement("button");
		btn.type = "submit";
		btn.className = "cb-prechat-submit";
		btn.textContent = "شروع گفتگو";
		this.prechatFormEl.appendChild(btn);
	}

	private fillPrechatForm(contact: {
		full_name: string | null;
		email: string | null;
		phone: string | null;
	}) {
		const name = this.prechatFormEl.querySelector("#cb-pc-name") as HTMLInputElement | null;
		const email = this.prechatFormEl.querySelector("#cb-pc-email") as HTMLInputElement | null;
		const phone = this.prechatFormEl.querySelector("#cb-pc-phone") as HTMLInputElement | null;
		if (name && contact.full_name && contact.full_name !== "Visitor") {
			name.value = contact.full_name;
		}
		if (email && contact.email) email.value = contact.email;
		if (phone && contact.phone) phone.value = contact.phone;
	}

	private showPrechat(contact: SessionResponse["contact"]) {
		this.prechatEl.classList.add("visible");
		this.messagesEl.classList.add("cb-chat-hidden");
		this.typingEl.classList.add("cb-chat-hidden");
		this.inputAreaEl.classList.add("cb-chat-hidden");
		this.fillPrechatForm(contact);
	}

	private hidePrechat() {
		this.prechatEl.classList.remove("visible");
		this.messagesEl.classList.remove("cb-chat-hidden");
		this.typingEl.classList.remove("cb-chat-hidden");
		this.inputAreaEl.classList.remove("cb-chat-hidden");
	}

	private async submitPrechat() {
		this.prechatErrorEl.textContent = "";
		const fd = new FormData(this.prechatFormEl);
		const payload: { full_name?: string; email?: string; phone?: string } = {};
		const name = fd.get("name");
		const email = fd.get("email");
		const phone = fd.get("phone");
		if (typeof name === "string") payload.full_name = name;
		if (typeof email === "string") payload.email = email;
		if (typeof phone === "string") payload.phone = phone;

		const submitBtn = this.prechatFormEl.querySelector(
			".cb-prechat-submit",
		) as HTMLButtonElement;
		submitBtn.disabled = true;

		try {
			const result = await updateContactProfile(payload);
			if (!result.profile_complete) {
				this.prechatErrorEl.textContent =
					"لطفاً فیلدهای الزامی را تکمیل کنید.";
				return;
			}
			this.hidePrechat();
			await this.startChat();
		} catch (err) {
			this.prechatErrorEl.textContent =
				err instanceof Error ? err.message : "ذخیره ناموفق بود.";
		} finally {
			submitBtn.disabled = false;
		}
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

			const needsPrechat =
				this.prechatFields().enabled && !session.profile_complete;

			if (needsPrechat) {
				this.showPrechat(session.contact);
				return;
			}

			await this.startChat();
		} catch (err) {
			console.error("[ChatBox] Init failed:", err);
		}
	}

	private async startChat() {
		if (this.chatStarted) return;
		this.chatStarted = true;
		this.hidePrechat();

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
			if (!this.prechatEl.classList.contains("visible")) {
				this.inputEl.focus();
			}
		}
	}

	private appendMessage(msg: Message, scroll = true) {
		if (msg.id) {
			if (this.renderedIds.has(msg.id)) return;
			this.renderedIds.add(msg.id);
		}
		const el = document.createElement("div");
		el.className = `cb-msg ${msg.senderType}`;
		this.renderMessageContent(el, msg);
		this.messagesEl.appendChild(el);
		if (scroll) this.scrollToBottom();
	}

	private renderMessageContent(el: HTMLElement, msg: Message) {
		const att = msg.attachments?.[0];
		if (att?.type === "image") {
			const img = document.createElement("img");
			img.className = "cb-msg-image";
			img.src = attachmentFullUrl(this.config.apiUrl, att.url);
			img.alt = att.name;
			el.appendChild(img);
		} else if (att?.type === "file") {
			const a = document.createElement("a");
			a.className = "cb-msg-file";
			a.href = attachmentFullUrl(this.config.apiUrl, att.url);
			a.target = "_blank";
			a.rel = "noopener";
			a.textContent = `📎 ${att.name}`;
			el.appendChild(a);
		}
		if (msg.body && !(att && msg.body === att.name && msg.type !== "text")) {
			const text = document.createElement("div");
			text.textContent = msg.body;
			el.appendChild(text);
		}
	}

	private scrollToBottom() {
		requestAnimationFrame(() => {
			this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		});
	}

	private async sendFile(file: File) {
		this.hideWelcome();
		this.sendBtn.disabled = true;
		try {
			const attachment = await uploadWidgetFile(file);
			const caption = this.inputEl.value.trim();
			const msg = await sendMessageHttp(this.config, caption || attachment.name, {
				type: attachment.type,
				attachments: [attachment],
			});
			this.inputEl.value = "";
			this.appendMessage(msg);
		} catch (err) {
			console.error("[ChatBox] Upload failed:", err);
		} finally {
			this.sendBtn.disabled = false;
			this.fileInputEl.value = "";
			this.inputEl.focus();
		}
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
