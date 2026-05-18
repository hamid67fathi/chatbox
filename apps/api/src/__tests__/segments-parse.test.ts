import { parseSegmentFilters } from "@chatbox/shared/segments";
import { describe, expect, it } from "vitest";

describe("parseSegmentFilters", () => {
	it("returns empty for invalid input", () => {
		expect(parseSegmentFilters(null)).toEqual({});
	});

	it("parses channels and tags", () => {
		const f = parseSegmentFilters({
			channels: ["widget", "invalid", "telegram"],
			tags: [" vip ", ""],
			tag_mode: "all",
			min_conversations: 2,
			max_conversations: 10,
		});
		expect(f.channels).toEqual(["widget", "telegram"]);
		expect(f.tags).toEqual(["vip"]);
		expect(f.tag_mode).toBe("all");
		expect(f.min_conversations).toBe(2);
		expect(f.max_conversations).toBe(10);
	});
});
