import { describe, expect, it } from "vitest";
import { agentPerformanceToCsv } from "../lib/agent-performance/index.js";

describe("agentPerformanceToCsv", () => {
	it("escapes commas in names", () => {
		const csv = agentPerformanceToCsv([
			{
				agent_id: "a1",
				agent_name: "Ali, Reza",
				agent_email: "a@b.com",
				conversations_total: 10,
				conversations_resolved: 8,
				resolution_rate: 80,
				avg_first_response_sec: 120,
				csat_average: 4.5,
				csat_count: 2,
			},
		]);
		expect(csv).toContain('"Ali, Reza"');
		expect(csv.split("\n")).toHaveLength(2);
	});
});
