export type FlowNodeType =
	| "start"
	| "message"
	| "question"
	| "condition"
	| "handoff";

export interface FlowNodeData {
	text?: string;
	variable?: string;
	conditions?: Array<{
		op: "eq" | "contains";
		value: string;
		target: string;
	}>;
	defaultTarget?: string;
}

export interface FlowNode {
	id: string;
	type: FlowNodeType;
	position?: { x: number; y: number };
	data: FlowNodeData;
}

export interface FlowEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string | null;
}

export interface FlowDefinition {
	nodes: FlowNode[];
	edges: FlowEdge[];
}

export const DEFAULT_FLOW_DEFINITION: FlowDefinition = {
	nodes: [
		{ id: "start", type: "start", position: { x: 200, y: 0 }, data: {} },
		{
			id: "welcome",
			type: "message",
			position: { x: 200, y: 100 },
			data: { text: "سلام! به پشتیبانی خوش آمدید." },
		},
		{
			id: "ask",
			type: "question",
			position: { x: 200, y: 220 },
			data: {
				text: "موضوع درخواست شما چیست؟",
				variable: "topic",
			},
		},
		{
			id: "handoff",
			type: "handoff",
			position: { x: 200, y: 340 },
			data: { text: "اپراتور به زودی پاسخ می‌دهد." },
		},
	],
	edges: [
		{ id: "e1", source: "start", target: "welcome" },
		{ id: "e2", source: "welcome", target: "ask" },
		{ id: "e3", source: "ask", target: "handoff" },
	],
};
