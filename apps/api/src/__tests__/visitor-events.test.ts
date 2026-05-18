import { describe, expect, it } from "vitest";
import {
	isVisitorEventType,
	retentionCutoffForPlan,
} from "../lib/visitor-events.js";

describe("visitor events", () => {
	it("validates event types", () => {
		expect(isVisitorEventType("page_view")).toBe(true);
		expect(isVisitorEventType("invalid")).toBe(false);
	});

	it("applies retention by plan", () => {
		const starter = retentionCutoffForPlan("starter");
		const pro = retentionCutoffForPlan("pro");
		const ent = retentionCutoffForPlan("enterprise");
		expect(starter).toBeInstanceOf(Date);
		expect(pro).toBeInstanceOf(Date);
		expect(ent).toBeNull();
		if (starter && pro) {
			expect(pro.getTime()).toBeLessThan(starter.getTime());
		}
	});
});
