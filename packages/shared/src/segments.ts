export const SEGMENT_CHANNELS = [
	"widget",
	"telegram",
	"email",
	"whatsapp",
	"api",
] as const;

export type SegmentChannel = (typeof SEGMENT_CHANNELS)[number];

export interface SegmentFilters {
	channels?: SegmentChannel[];
	tags?: string[];
	tag_mode?: "any" | "all";
	min_conversations?: number;
	max_conversations?: number;
	last_seen_after?: string;
	last_seen_before?: string;
}

const CHANNEL_SET = new Set<string>(SEGMENT_CHANNELS);

export function parseSegmentFilters(raw: unknown): SegmentFilters {
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const filters: SegmentFilters = {};

	if (Array.isArray(o.channels)) {
		filters.channels = o.channels.filter(
			(c): c is SegmentChannel =>
				typeof c === "string" && CHANNEL_SET.has(c),
		);
	}

	if (Array.isArray(o.tags)) {
		filters.tags = o.tags
			.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
			.map((t) => t.trim());
	}

	if (o.tag_mode === "any" || o.tag_mode === "all") {
		filters.tag_mode = o.tag_mode;
	}

	if (typeof o.min_conversations === "number" && Number.isFinite(o.min_conversations)) {
		filters.min_conversations = Math.max(0, Math.round(o.min_conversations));
	}

	if (typeof o.max_conversations === "number" && Number.isFinite(o.max_conversations)) {
		filters.max_conversations = Math.max(0, Math.round(o.max_conversations));
	}

	if (typeof o.last_seen_after === "string" && o.last_seen_after.trim()) {
		filters.last_seen_after = o.last_seen_after.trim();
	}

	if (typeof o.last_seen_before === "string" && o.last_seen_before.trim()) {
		filters.last_seen_before = o.last_seen_before.trim();
	}

	return filters;
}
