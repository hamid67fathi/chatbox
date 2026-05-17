import { describe, expect, it } from "vitest";
import { computeLimitLevel } from "../lib/plan-limits.js";

describe("computeLimitLevel", () => {
	it("returns unlimited when limit is null", () => {
		expect(computeLimitLevel(999, null)).toBe("unlimited");
	});

	it("returns exhausted at or above 100%", () => {
		expect(computeLimitLevel(100, 100)).toBe("exhausted");
		expect(computeLimitLevel(101, 100)).toBe("exhausted");
	});

	it("returns warning between 80% and 100%", () => {
		expect(computeLimitLevel(80, 100)).toBe("warning");
		expect(computeLimitLevel(99, 100)).toBe("warning");
	});

	it("returns ok below warning threshold", () => {
		expect(computeLimitLevel(0, 100)).toBe("ok");
		expect(computeLimitLevel(79, 100)).toBe("ok");
	});
});
