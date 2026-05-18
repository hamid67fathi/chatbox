import { describe, expect, it } from "vitest";
import {
	DEFAULT_BUSINESS_HOURS,
	isWithinBusinessHours,
	parseBusinessHours,
} from "../lib/business-hours.js";

describe("business-hours", () => {
	it("parses settings from workspace", () => {
		const cfg = parseBusinessHours({
			business_hours: {
				enabled: true,
				timezone: "Asia/Tehran",
				holidays: ["2026-01-01"],
				schedule: {
					mon: { enabled: true, start: "10:00", end: "17:00" },
				},
			},
		});
		expect(cfg.enabled).toBe(true);
		expect(cfg.holidays).toEqual(["2026-01-01"]);
		expect(cfg.schedule.mon?.start).toBe("10:00");
	});

	it("returns open when disabled", () => {
		expect(
			isWithinBusinessHours({ ...DEFAULT_BUSINESS_HOURS, enabled: false }),
		).toBe(true);
	});

	it("respects holiday", () => {
		const cfg = {
			...DEFAULT_BUSINESS_HOURS,
			enabled: true,
			timezone: "UTC",
			schedule: {
				mon: { enabled: true, start: "00:00", end: "23:59" },
			},
			holidays: ["2026-05-18"],
		};
		const monday = new Date("2026-05-18T12:00:00.000Z");
		expect(isWithinBusinessHours(cfg, monday)).toBe(false);
	});
});
