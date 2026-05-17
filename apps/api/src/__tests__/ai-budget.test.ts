import { describe, expect, it } from "vitest";
import { estimateCostUsd, tokensToCredits } from "../lib/ai-budget.js";

describe("ai-budget", () => {
	it("tokensToCredits charges at least 1 per non-zero usage", () => {
		expect(tokensToCredits(0, 0)).toBe(0);
		expect(tokensToCredits(100, 50)).toBe(1);
		expect(tokensToCredits(1500, 500)).toBe(2);
	});

	it("estimateCostUsd returns a numeric string", () => {
		const v = estimateCostUsd("openai:gpt-4o-mini", 1000, 500);
		expect(Number.parseFloat(v)).toBeGreaterThan(0);
	});
});
