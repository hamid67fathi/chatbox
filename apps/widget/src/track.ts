import { loadVisitorId } from "./visitor-id.js";

export type TrackEventType =
	| "page_view"
	| "session_start"
	| "session_end"
	| "conversation_started"
	| "custom_event";

export function trackVisitorEvent(
	apiUrl: string,
	workspaceKey: string,
	workspaceSlug: string,
	eventType: TrackEventType,
	fields?: {
		url?: string | null;
		referrer?: string | null;
		payload?: Record<string, unknown>;
		contact_id?: string | null;
	},
): void {
	const visitorId = loadVisitorId(workspaceSlug);
	if (!visitorId || !workspaceKey) return;

	const body = JSON.stringify({
		workspace_key: workspaceKey,
		visitor_id: visitorId,
		event_type: eventType,
		url: fields?.url ?? null,
		referrer: fields?.referrer ?? null,
		payload: fields?.payload ?? {},
		contact_id: fields?.contact_id ?? null,
	});

	const url = `${apiUrl.replace(/\/$/, "")}/v1/track`;

	if (
		eventType === "session_end" &&
		typeof navigator !== "undefined" &&
		typeof navigator.sendBeacon === "function"
	) {
		const blob = new Blob([body], { type: "application/json" });
		navigator.sendBeacon(url, blob);
		return;
	}

	void fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
		keepalive: eventType === "session_end",
	}).catch(() => {});
}
