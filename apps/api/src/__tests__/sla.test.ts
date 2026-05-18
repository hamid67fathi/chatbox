import { describe, expect, it } from "vitest";
import { computeSlaStatus, defaultSlaPolicyForPlan } from "../lib/sla/compute.js";

describe("sla", () => {
	it("defaults vary by plan", () => {
		const free = defaultSlaPolicyForPlan("free");
		const pro = defaultSlaPolicyForPlan("pro");
		expect(pro.first_response_minutes).toBeLessThan(
			free.first_response_minutes,
		);
	});

	it("marks breached first response", () => {
		const created = new Date("2026-01-01T10:00:00.000Z");
		const now = new Date("2026-01-01T10:20:00.000Z");
		const sla = computeSlaStatus(
			{
				createdAt: created,
				firstResponseAt: null,
				firstResponseSec: null,
				resolvedAt: null,
				closedAt: null,
				status: "open",
			},
			{
				enabled: true,
				first_response_minutes: 15,
				resolution_minutes: 60,
				warn_at_percent: 80,
			},
			now,
		);
		expect(sla.first_response).toBe("breached");
	});

	it("marks ok when responded in time", () => {
		const created = new Date("2026-01-01T10:00:00.000Z");
		const responded = new Date("2026-01-01T10:05:00.000Z");
		const sla = computeSlaStatus(
			{
				createdAt: created,
				firstResponseAt: responded,
				firstResponseSec: 300,
				resolvedAt: null,
				closedAt: null,
				status: "open",
			},
			{
				enabled: true,
				first_response_minutes: 15,
				resolution_minutes: 60,
				warn_at_percent: 80,
			},
			responded,
		);
		expect(sla.first_response).toBe("ok");
	});
});
