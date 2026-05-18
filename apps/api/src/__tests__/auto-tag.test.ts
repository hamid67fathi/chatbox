import { describe, expect, it } from "vitest";
import { normalizeTag, normalizeTags } from "../lib/auto-tag.js";

describe("normalizeTags", () => {
	it("slugifies and dedupes", () => {
		expect(normalizeTags(["Billing", "billing", "Refund Request"])).toEqual([
			"billing",
			"refund-request",
		]);
	});

	it("rejects empty tags", () => {
		expect(normalizeTag("   ")).toBeNull();
		expect(normalizeTag("!!!")).toBeNull();
	});
});
