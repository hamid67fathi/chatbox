import type { RoutingAction, RoutingConditions } from "./types.js";

const CHANNELS = new Set([
	"widget",
	"telegram",
	"email",
	"whatsapp",
	"api",
]);

const ACTION_TYPES = new Set([
	"assign_agent",
	"round_robin",
	"enable_ai",
	"set_priority",
]);

export function parseRoutingConditions(raw: unknown): RoutingConditions {
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const conditions: RoutingConditions = {};

	if (Array.isArray(o.channels)) {
		conditions.channels = o.channels.filter(
			(c): c is string => typeof c === "string" && CHANNELS.has(c),
		);
	}

	if (Array.isArray(o.keywords)) {
		conditions.keywords = o.keywords
			.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
			.map((k) => k.trim());
	}

	if (o.keyword_mode === "any" || o.keyword_mode === "all") {
		conditions.keyword_mode = o.keyword_mode;
	}

	if (typeof o.segment_id === "string" && o.segment_id.trim()) {
		conditions.segment_id = o.segment_id.trim();
	}

	return conditions;
}

export function parseRoutingAction(raw: unknown): RoutingAction {
	if (!raw || typeof raw !== "object") {
		return { type: "assign_agent" };
	}
	const o = raw as Record<string, unknown>;
	const type =
		typeof o.type === "string" && ACTION_TYPES.has(o.type)
			? (o.type as RoutingAction["type"])
			: "assign_agent";

	const action: RoutingAction = { type };

	if (typeof o.agent_id === "string" && o.agent_id.trim()) {
		action.agent_id = o.agent_id.trim();
	}

	if (Array.isArray(o.agent_ids)) {
		action.agent_ids = o.agent_ids.filter(
			(id): id is string => typeof id === "string" && id.trim().length > 0,
		);
	}

	if (typeof o.priority === "number" && Number.isFinite(o.priority)) {
		action.priority = Math.max(0, Math.min(9, Math.round(o.priority)));
	}

	return action;
}
