import { describe, expect, it } from "vitest";
import { parseHandoffBrief } from "../lib/handoff-brief.js";

describe("parseHandoffBrief", () => {
	it("returns null for empty metadata", () => {
		expect(parseHandoffBrief(null)).toBeNull();
		expect(parseHandoffBrief({})).toBeNull();
	});

	it("parses valid handoff brief", () => {
		const brief = parseHandoffBrief({
			handoff_brief: {
				summary: "Customer asked about refund.",
				key_points: ["Order #123", "Wants refund"],
				suggested_reply: "Hello, I can help with your refund.",
				generated_at: "2026-05-16T12:00:00.000Z",
				context: { channel: "widget", tags: ["billing"] },
			},
		});
		expect(brief).not.toBeNull();
		expect(brief?.summary).toBe("Customer asked about refund.");
		expect(brief?.key_points).toEqual(["Order #123", "Wants refund"]);
		expect(brief?.suggested_reply).toBe("Hello, I can help with your refund.");
		expect(brief?.context?.channel).toBe("widget");
	});

	it("returns null when summary is missing", () => {
		expect(
			parseHandoffBrief({
				handoff_brief: { key_points: [], suggested_reply: "" },
			}),
		).toBeNull();
	});
});
