export const WIDGET_CSS = `
:host {
  all: initial;
  font-family: 'Vazirmatn', 'Segoe UI', Tahoma, system-ui, sans-serif;
  font-size: 14px;
  direction: rtl;

  --cb-primary: #2563eb;
  --cb-primary-hover: #1d4ed8;
  --cb-surface: #ffffff;
  --cb-text-on-primary: #ffffff;
  --cb-agent-bg: #f1f5f9;
  --cb-agent-text: #1e293b;
  --cb-border: #e2e8f0;
}

.cb-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
  font-family: inherit;
}

.cb-container.cb-pos-left {
  right: auto;
  left: 20px;
}

.cb-launcher {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--cb-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: transform 0.2s, box-shadow 0.2s;
}

.cb-launcher:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

.cb-launcher svg {
  width: 28px;
  height: 28px;
  fill: var(--cb-text-on-primary);
}

.cb-window {
  display: none;
  position: fixed;
  bottom: 88px;
  right: 20px;
  width: 370px;
  height: 520px;
  max-height: calc(100vh - 100px);
  background: var(--cb-surface);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  flex-direction: column;
  overflow: hidden;
  z-index: 999998;
}

.cb-container.cb-pos-left .cb-window {
  right: auto;
  left: 20px;
}

.cb-window.open {
  display: flex;
}

.cb-header {
  background: var(--cb-primary);
  color: var(--cb-text-on-primary);
  padding: 12px 16px;
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
}

.cb-header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(255,255,255,0.2);
}

.cb-close {
  background: none;
  border: none;
  color: var(--cb-text-on-primary);
  cursor: pointer;
  font-size: 20px;
  padding: 0 4px;
  flex-shrink: 0;
}

.cb-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* LTR column: visitor (contact) right, agent/AI left */
  direction: ltr;
}

.cb-welcome {
  align-self: flex-start;
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  background: var(--cb-agent-bg);
  color: var(--cb-agent-text);
  border-bottom-left-radius: 4px;
}

.cb-msg {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.cb-msg-image {
  display: block;
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.cb-msg-file {
  display: block;
  font-size: 13px;
  text-decoration: underline;
  margin-bottom: 4px;
}

.cb-msg.contact {
  align-self: flex-end;
  background: var(--cb-primary);
  color: var(--cb-text-on-primary);
  border-bottom-right-radius: 4px;
  position: relative;
  padding-bottom: 18px;
}

.cb-msg.contact .cb-msg-file {
  color: var(--cb-text-on-primary);
}

.cb-msg.agent, .cb-msg.ai, .cb-msg.system {
  align-self: flex-start;
  background: var(--cb-agent-bg);
  color: var(--cb-agent-text);
  border-bottom-left-radius: 4px;
}

.cb-typing {
  align-self: flex-start;
  padding: 8px 14px;
  font-size: 12px;
  color: #94a3b8;
  display: none;
}

.cb-typing.visible {
  display: block;
}

.cb-input-area .hidden {
  display: none;
}

.cb-attach {
  background: transparent;
  border: 1px solid var(--cb-border);
  border-radius: 8px;
  width: 40px;
  height: 40px;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
}

.cb-input-area {
  display: flex;
  padding: 12px;
  border-top: 1px solid var(--cb-border);
  gap: 8px;
  align-items: center;
}

.cb-input {
  flex: 1;
  border: 1px solid var(--cb-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  direction: rtl;
}

.cb-input:focus {
  border-color: var(--cb-primary);
}

.cb-send {
  background: var(--cb-primary);
  color: var(--cb-text-on-primary);
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.cb-send:hover {
  background: var(--cb-primary-hover);
}

.cb-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cb-prechat {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: none;
  flex-direction: column;
  gap: 12px;
}

.cb-prechat.visible {
  display: flex;
}

.cb-prechat-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--cb-agent-text);
  margin: 0;
}

.cb-prechat-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.cb-prechat label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--cb-agent-text);
}

.cb-prechat input {
  border: 1px solid var(--cb-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  direction: rtl;
}

.cb-prechat input:focus {
  border-color: var(--cb-primary);
  outline: none;
}

.cb-prechat-error {
  font-size: 12px;
  color: #dc2626;
  margin: 0;
}

.cb-prechat-submit {
  margin-top: 4px;
  background: var(--cb-primary);
  color: var(--cb-text-on-primary);
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.cb-prechat-submit:hover {
  background: var(--cb-primary-hover);
}

.cb-prechat-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cb-chat-hidden {
  display: none !important;
}

.cb-emoji-picker {
  display: none;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  max-height: 120px;
  overflow-y: auto;
  border-top: 1px solid var(--cb-border);
  background: var(--cb-surface);
}

.cb-emoji-picker.open {
  display: flex;
}

.cb-emoji-item {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  line-height: 1;
}

.cb-emoji-item:hover {
  background: var(--cb-agent-bg);
}

.cb-msg-meta {
  position: absolute;
  bottom: 4px;
  right: 8px;
  left: auto;
  font-size: 10px;
  opacity: 0.75;
  line-height: 1;
}

@media (max-width: 480px) {
  .cb-window {
    width: calc(100vw - 16px);
    height: calc(100vh - 88px);
    max-height: none;
    bottom: 72px;
    right: 8px;
    border-radius: 12px;
  }
  .cb-container.cb-pos-left .cb-window {
    left: 8px;
    right: auto;
  }
  .cb-container {
    right: 8px;
    bottom: 12px;
  }
  .cb-container.cb-pos-left {
    left: 8px;
    right: auto;
  }
}
`;

/** Darken hex color by ~12% for hover */
export function darkenHex(hex: string, amount = 0.12): string {
	const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
	if (!m) return hex;
	const n = Number.parseInt(m[1], 16);
	const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount)) | 0;
	const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amount)) | 0;
	const b = Math.max(0, (n & 0xff) * (1 - amount)) | 0;
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
