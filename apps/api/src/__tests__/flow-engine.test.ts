import { describe, expect, it } from "vitest";
import { parseFlowDefinition } from "../lib/flow-engine/parse.js";
import { DEFAULT_FLOW_DEFINITION } from "../lib/flow-engine/types.js";

describe("flow-engine", () => {
	it("returns default definition for invalid input", () => {
		const def = parseFlowDefinition(null);
		expect(def.nodes.length).toBe(DEFAULT_FLOW_DEFINITION.nodes.length);
		expect(def.edges.length).toBe(DEFAULT_FLOW_DEFINITION.edges.length);
	});

	it("parses nodes and edges", () => {
		const def = parseFlowDefinition({
			nodes: [
				{ id: "start", type: "start", data: {} },
				{
					id: "m1",
					type: "message",
					data: { text: "hello" },
					position: { x: 10, y: 20 },
				},
			],
			edges: [{ id: "e1", source: "start", target: "m1" }],
		});
		expect(def.nodes).toHaveLength(2);
		expect(def.nodes[1]?.data.text).toBe("hello");
		expect(def.edges[0]?.target).toBe("m1");
	});
});
