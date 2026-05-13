export const WIDGET_CSS = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  direction: rtl;
}

.cb-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
  font-family: inherit;
}

.cb-launcher {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2563eb;
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
  fill: white;
}

.cb-window {
  display: none;
  position: fixed;
  bottom: 88px;
  right: 20px;
  width: 370px;
  height: 520px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  flex-direction: column;
  overflow: hidden;
  z-index: 999998;
}

.cb-window.open {
  display: flex;
}

.cb-header {
  background: #2563eb;
  color: white;
  padding: 16px;
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cb-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 20px;
  padding: 0 4px;
}

.cb-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cb-msg {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.cb-msg.contact {
  align-self: flex-end;
  background: #2563eb;
  color: white;
  border-bottom-right-radius: 4px;
}

.cb-msg.agent, .cb-msg.ai, .cb-msg.system {
  align-self: flex-start;
  background: #f1f5f9;
  color: #1e293b;
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

.cb-input-area {
  display: flex;
  padding: 12px;
  border-top: 1px solid #e2e8f0;
  gap: 8px;
}

.cb-input {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  direction: rtl;
}

.cb-input:focus {
  border-color: #2563eb;
}

.cb-send {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.cb-send:hover {
  background: #1d4ed8;
}

.cb-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
