import { describe, expect, it } from "vitest";
import {
	filterTimelineEvents,
	paginateTimelineEvents,
	sortTimelineEvents,
	type TimelineEvent,
} from "../lib/contact-timeline.js";

const base = (id: string, at: string): TimelineEvent => ({
	id,
	type: "message",
	occurred_at: at,
	conversation_id: "c1",
	channel: "widget",
	payload: {},
});

describe("contact timeline helpers", () => {
	it("sorts events newest first", () => {
		const sorted = sortTimelineEvents([
			base("a", "2026-01-01T10:00:00.000Z"),
			base("b", "2026-01-02T10:00:00.000Z"),
		]);
		expect(sorted[0]?.id).toBe("b");
	});

	it("filters by date range", () => {
		const events = [
			base("a", "2026-01-01T10:00:00.000Z"),
			base("b", "2026-01-15T10:00:00.000Z"),
		];
		const filtered = filterTimelineEvents(events, {
			from: new Date("2026-01-10T00:00:00.000Z"),
			to: new Date("2026-01-20T00:00:00.000Z"),
		});
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.id).toBe("b");
	});

	it("paginates with cursor", () => {
		const events = [
			base("c", "2026-01-03T10:00:00.000Z"),
			base("b", "2026-01-02T10:00:00.000Z"),
			base("a", "2026-01-01T10:00:00.000Z"),
		];
		const page1 = paginateTimelineEvents(events, 2, undefined);
		expect(page1.events).toHaveLength(2);
		expect(page1.next_cursor).toBeTruthy();

		const page2 = paginateTimelineEvents(events, 2, page1.next_cursor ?? undefined);
		expect(page2.events).toHaveLength(1);
		expect(page2.next_cursor).toBeNull();
	});
});
