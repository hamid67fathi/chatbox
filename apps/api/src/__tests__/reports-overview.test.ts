import { describe, expect, it } from "vitest";
import { peakHourLabel, reportsOverviewToCsv } from "../lib/reports/overview.js";

describe("reportsOverviewToCsv", () => {
	it("includes funnel and channel rows", () => {
		const csv = reportsOverviewToCsv({
			conversations_over_time: [
				{ day: "2026-05-01", created: 5, resolved: 2 },
			],
			peak_hours: [{ dow: 0, hour: 10, count: 3 }],
			channels: [{ channel: "widget", count: 5 }],
			top_tags: [{ tag: "billing", count: 2 }],
			funnel: {
				started: 10,
				agent_replied: 8,
				resolved: 6,
				closed: 4,
			},
		});
		expect(csv).toContain("funnel,started,10");
		expect(csv).toContain("channel,widget,5");
		expect(csv).toContain("tag,billing,2");
	});
});

describe("peakHourLabel", () => {
	it("formats day and hour", () => {
		expect(peakHourLabel(0, 14)).toContain("14:00");
	});
});
