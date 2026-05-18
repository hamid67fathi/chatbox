import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { conversations, flowSessions, flows, messages } from "../../db/schema/index.js";
import { deliverNewMessage } from "../message-delivery.js";
import { parseFlowDefinition } from "./parse.js";
import type { FlowDefinition, FlowNode } from "./types.js";

function getNode(def: FlowDefinition, id: string): FlowNode | undefined {
	return def.nodes.find((n) => n.id === id);
}

function getOutgoingEdges(def: FlowDefinition, nodeId: string, handle?: string) {
	return def.edges.filter(
		(e) =>
			e.source === nodeId &&
			(handle == null || !e.sourceHandle || e.sourceHandle === handle),
	);
}

function pickNextNodeId(
	def: FlowDefinition,
	nodeId: string,
	variables: Record<string, unknown>,
	handle?: string,
): string | null {
	const node = getNode(def, nodeId);
	if (!node) return null;

	if (node.type === "condition") {
		const varName = node.data.variable ?? "";
		const value = String(variables[varName] ?? "");
		for (const rule of node.data.conditions ?? []) {
			const match =
				rule.op === "eq"
					? value === rule.value
					: value.includes(rule.value);
			if (match) return rule.target;
		}
		if (node.data.defaultTarget) return node.data.defaultTarget;
	}

	const edges = getOutgoingEdges(def, nodeId, handle);
	return edges[0]?.target ?? null;
}

async function sendFlowMessage(
	workspaceId: string,
	conversationId: string,
	text: string,
) {
	const body = text.trim();
	if (!body) return;

	const [msg] = await db
		.insert(messages)
		.values({
			workspaceId,
			conversationId,
			senderType: "ai",
			type: "text",
			body,
			aiModel: "flow",
		})
		.returning();

	await deliverNewMessage(msg, conversationId, workspaceId);
}

async function handoffToAgent(workspaceId: string, conversationId: string) {
	await db
		.update(conversations)
		.set({ aiHandled: false, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));

	try {
		const { getIO } = await import("../../ws/broadcast.js");
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("conv:needs_human", {
			conversation_id: conversationId,
			reason: "flow_handoff",
		});
	} catch {
		/* socket not ready */
	}

	const { triggerHandoffBrief } = await import("../conversation-insights.js");
	triggerHandoffBrief(workspaceId, conversationId);
}

export async function getPublishedFlow(
	workspaceId: string,
	trigger = "widget_start",
) {
	return db.query.flows.findFirst({
		where: and(
			eq(flows.workspaceId, workspaceId),
			eq(flows.status, "published"),
			eq(flows.trigger, trigger),
		),
		orderBy: (f, { desc }) => [desc(f.publishedAt)],
	});
}

export async function getActiveFlowSession(conversationId: string) {
	return db.query.flowSessions.findFirst({
		where: and(
			eq(flowSessions.conversationId, conversationId),
			eq(flowSessions.status, "active"),
		),
	});
}

export async function startFlowSession(
	workspaceId: string,
	flowId: string,
	conversationId: string,
	contactId: string,
): Promise<typeof flowSessions.$inferSelect> {
	const flow = await db.query.flows.findFirst({
		where: and(eq(flows.id, flowId), eq(flows.workspaceId, workspaceId)),
	});
	if (!flow) throw new Error("Flow not found");

	const [session] = await db
		.insert(flowSessions)
		.values({
			workspaceId,
			flowId,
			conversationId,
			contactId,
			currentNodeId: "start",
			status: "active",
			variables: {},
		})
		.returning();

	await db
		.update(conversations)
		.set({ aiHandled: true, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));

	return session;
}

async function executeNode(
	workspaceId: string,
	conversationId: string,
	session: typeof flowSessions.$inferSelect,
	node: FlowNode,
): Promise<"continue" | "wait" | "done"> {
	switch (node.type) {
		case "start":
			return "continue";
		case "message": {
			if (node.data.text) {
				await sendFlowMessage(workspaceId, conversationId, node.data.text);
			}
			return "continue";
		}
		case "question": {
			if (node.data.text) {
				await sendFlowMessage(workspaceId, conversationId, node.data.text);
			}
			return "wait";
		}
		case "condition":
			return "continue";
		case "handoff": {
			if (node.data.text) {
				await sendFlowMessage(workspaceId, conversationId, node.data.text);
			}
			await handoffToAgent(workspaceId, conversationId);
			await db
				.update(flowSessions)
				.set({
					status: "handed_off",
					currentNodeId: node.id,
					updatedAt: new Date(),
				})
				.where(eq(flowSessions.id, session.id));
			return "done";
		}
		default:
			return "continue";
	}
}

export async function runFlowUntilWait(
	sessionId: string,
): Promise<void> {
	const session = await db.query.flowSessions.findFirst({
		where: eq(flowSessions.id, sessionId),
	});
	if (!session || session.status !== "active") return;

	const flow = await db.query.flows.findFirst({
		where: eq(flows.id, session.flowId),
	});
	if (!flow) return;

	const def = parseFlowDefinition(flow.definition);
	let nodeId = session.currentNodeId ?? "start";
	const variables = { ...(session.variables as Record<string, unknown>) };

	for (let guard = 0; guard < 50; guard++) {
		const node = getNode(def, nodeId);
		if (!node) break;

		const outcome = await executeNode(
			session.workspaceId,
			session.conversationId,
			session,
			node,
		);

		if (outcome === "wait") {
			await db
				.update(flowSessions)
				.set({
					currentNodeId: nodeId,
					variables,
					updatedAt: new Date(),
				})
				.where(eq(flowSessions.id, session.id));
			return;
		}

		if (outcome === "done") return;

		const nextId = pickNextNodeId(def, nodeId, variables);
		if (!nextId) {
			await db
				.update(flowSessions)
				.set({ status: "completed", updatedAt: new Date() })
				.where(eq(flowSessions.id, session.id));
			return;
		}
		nodeId = nextId;
	}

	await db
		.update(flowSessions)
		.set({ status: "completed", updatedAt: new Date() })
		.where(eq(flowSessions.id, session.id));
}

export async function processContactMessageInFlow(
	conversationId: string,
	text: string,
): Promise<boolean> {
	const session = await getActiveFlowSession(conversationId);
	if (!session) return false;

	const flow = await db.query.flows.findFirst({
		where: eq(flows.id, session.flowId),
	});
	if (!flow) return false;

	const def = parseFlowDefinition(flow.definition);
	const current = getNode(def, session.currentNodeId ?? "");
	if (!current || current.type !== "question") return false;

	const variables = {
		...(session.variables as Record<string, unknown>),
		[current.data.variable ?? "answer"]: text.trim(),
	};

	const nextId = pickNextNodeId(def, current.id, variables);
	if (!nextId) {
		await db
			.update(flowSessions)
			.set({
				status: "completed",
				variables,
				updatedAt: new Date(),
			})
			.where(eq(flowSessions.id, session.id));
		return true;
	}

	await db
		.update(flowSessions)
		.set({
			currentNodeId: nextId,
			variables,
			updatedAt: new Date(),
		})
		.where(eq(flowSessions.id, session.id));

	await runFlowUntilWait(session.id);
	return true;
}

export async function tryStartWidgetFlow(
	workspaceId: string,
	conversationId: string,
	contactId: string,
): Promise<boolean> {
	const existing = await getActiveFlowSession(conversationId);
	if (existing) return true;

	const flow = await getPublishedFlow(workspaceId, "widget_start");
	if (!flow) return false;

	const session = await startFlowSession(
		workspaceId,
		flow.id,
		conversationId,
		contactId,
	);
	await runFlowUntilWait(session.id);
	return true;
}
