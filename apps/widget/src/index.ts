import { installCbxGlobal } from "./cbx.js";
import { ChatBoxWidget } from "./widget.js";
import { loadVisitorId } from "./visitor-id.js";

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

	const visitorId = loadVisitorId(workspaceSlug);

	installCbxGlobal();

	const widget = new ChatBoxWidget({ apiUrl, workspaceSlug, visitorId });
	(window as unknown as Record<string, unknown>).__chatbox = widget;
	void widget.mount().catch((err) => {
		console.error("[ChatBox] mount failed:", err);
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", autoInit);
	} else {
		autoInit();
	}
}
