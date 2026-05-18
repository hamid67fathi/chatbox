import { describe, expect, it } from "vitest";
import { parseRoutingAction, parseRoutingConditions } from "../lib/routing/parse.js";

describe("routing parse", () => {
	it("parses channel conditions", () => {
		const c = parseRoutingConditions({
			channels: ["widget", "telegram", "invalid"],
			keywords: ["help", "  "],
			keyword_mode: "all",
		});
		expect(c.channels).toEqual(["widget", "telegram"]);
		expect(c.keywords).toEqual(["help"]);
		expect(c.keyword_mode).toBe("all");
	});

	it("parses assign and round_robin actions", () => {
		const a = parseRoutingAction({
			type: "round_robin",
			agent_ids: ["a1", "a2"],
			priority: 12,
		});
		expect(a.type).toBe("round_robin");
		expect(a.agent_ids).toEqual(["a1", "a2"]);
		expect(a.priority).toBe(9);
	});
});
