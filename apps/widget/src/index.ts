import { ChatBoxWidget } from "./widget.js";

export { ChatBoxWidget };
export type { WidgetConfig, WidgetTheme } from "./api.js";

function findWidgetScript(): HTMLScriptElement | null {
	return (
		(document.currentScript as HTMLScriptElement | null) ??
		document.querySelector<HTMLScriptElement>(
			"script[data-api-url][data-workspace-slug]",
		)
	);
}

function autoInit() {
	const script = findWidgetScript();
	if (!script) {
		console.error(
			"[ChatBox] Could not find widget script tag (data-api-url, data-workspace-slug).",
		);
		return;
	}

	const apiUrl = script.dataset.apiUrl;
	const workspaceSlug = script.dataset.workspaceSlug;

	if (!apiUrl || !workspaceSlug) {
		console.error("[ChatBox] data-api-url and data-workspace-slug are required.");
		return;
	}

	const widget = new ChatBoxWidget({ apiUrl, workspaceSlug });
	void widget.mount().catch((err) => {
		console.error("[ChatBox] mount failed:", err);
	});

	(window as unknown as Record<string, unknown>).__chatbox = widget;
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", autoInit);
	} else {
		autoInit();
	}
}
