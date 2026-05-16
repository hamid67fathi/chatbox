import { ChatBoxWidget } from "./widget.js";

export { ChatBoxWidget };
export type { WidgetConfig, WidgetTheme } from "./api.js";

function autoInit() {
	const script = document.currentScript as HTMLScriptElement | null;
	if (!script) return;

	const apiUrl = script.dataset.apiUrl;
	const workspaceSlug = script.dataset.workspaceSlug;

	if (!apiUrl || !workspaceSlug) return;

	const widget = new ChatBoxWidget({ apiUrl, workspaceSlug });
	widget.mount();

	(window as unknown as Record<string, unknown>).__chatbox = widget;
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", autoInit);
	} else {
		autoInit();
	}
}
