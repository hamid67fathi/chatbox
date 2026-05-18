import type { FlowDefinition, FlowEdge, FlowNode } from "./types.js";
import { DEFAULT_FLOW_DEFINITION } from "./types.js";

export function parseFlowDefinition(raw: unknown): FlowDefinition {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_FLOW_DEFINITION };

	const o = raw as Record<string, unknown>;
	const nodesRaw = Array.isArray(o.nodes) ? o.nodes : [];
	const edgesRaw = Array.isArray(o.edges) ? o.edges : [];

	const nodes: FlowNode[] = [];
	for (const item of nodesRaw) {
		if (!item || typeof item !== "object") continue;
		const n = item as Record<string, unknown>;
		const id = typeof n.id === "string" ? n.id : "";
		const type = typeof n.type === "string" ? n.type : "";
		if (!id || !["start", "message", "question", "condition", "handoff"].includes(type)) {
			continue;
		}
		const data =
			n.data && typeof n.data === "object"
				? (n.data as FlowNode["data"])
				: {};
		const position =
			n.position &&
			typeof n.position === "object" &&
			typeof (n.position as { x?: unknown }).x === "number" &&
			typeof (n.position as { y?: unknown }).y === "number"
				? {
						x: (n.position as { x: number }).x,
						y: (n.position as { y: number }).y,
					}
				: undefined;
		nodes.push({
			id,
			type: type as FlowNode["type"],
			position,
			data,
		});
	}

	const edges: FlowEdge[] = [];
	for (const item of edgesRaw) {
		if (!item || typeof item !== "object") continue;
		const e = item as Record<string, unknown>;
		if (typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") {
			continue;
		}
		edges.push({
			id: e.id,
			source: e.source,
			target: e.target,
			sourceHandle:
				typeof e.sourceHandle === "string" ? e.sourceHandle : null,
		});
	}

	if (nodes.length === 0) return { ...DEFAULT_FLOW_DEFINITION };
	return { nodes, edges };
}
