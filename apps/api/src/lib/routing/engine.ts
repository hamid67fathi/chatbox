import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
	contacts,
	conversations,
	routingRules,
	workspaceMembers,
	workspaces,
} from "../../db/schema/index.js";
import { parseRoutingAction, parseRoutingConditions } from "./parse.js";
import type {
	RoutingAction,
	RoutingConditions,
	RoutingContext,
	RoutingRuleRow,
} from "./types.js";

function routingRoot(settings: unknown): Record<string, unknown> {
	if (!settings || typeof settings !== "object") return {};
	const root = settings as Record<string, unknown>;
	const routing = root.routing;
	if (!routing || typeof routing !== "object") return {};
	return routing as Record<string, unknown>;
}

function matchesChannel(conditions: RoutingConditions, channel: string): boolean {
	if (!conditions.channels?.length) return true;
	return conditions.channels.includes(channel);
}

function matchesKeywords(
	conditions: RoutingConditions,
	text: string | undefined,
): boolean {
	const keywords = conditions.keywords;
	if (!keywords?.length) return true;
	if (!text?.trim()) return false;

	const hay = text.toLowerCase();
	const mode = conditions.keyword_mode ?? "any";
	const hits = keywords.map((k) => hay.includes(k.toLowerCase()));
	return mode === "all" ? hits.every(Boolean) : hits.some(Boolean);
}

function needsMessageText(conditions: RoutingConditions): boolean {
	return Boolean(conditions.keywords?.length);
}

async function ruleMatches(
	conditions: RoutingConditions,
	ctx: RoutingContext,
): Promise<boolean> {
	if (!matchesChannel(conditions, ctx.channel)) return false;

	if (needsMessageText(conditions)) {
		if (ctx.trigger !== "contact_message") return false;
		if (!matchesKeywords(conditions, ctx.messageText)) return false;
	}

	if (conditions.segment_id) {
		const conv = await db.query.conversations.findFirst({
			where: and(
				eq(conversations.id, ctx.conversationId),
				eq(conversations.workspaceId, ctx.workspaceId),
			),
			columns: { contactId: true },
		});
		if (!conv) return false;
		const { getSegmentFiltersById, isContactInSegment } = await import(
			"../segments/index.js"
		);
		const filters = await getSegmentFiltersById(
			ctx.workspaceId,
			conditions.segment_id,
		);
		if (!filters) return false;
		const inSegment = await isContactInSegment(
			ctx.workspaceId,
			conv.contactId,
			filters,
		);
		if (!inSegment) return false;
	}

	return true;
}

async function loadRules(workspaceId: string): Promise<RoutingRuleRow[]> {
	const rows = await db.query.routingRules.findMany({
		where: and(
			eq(routingRules.workspaceId, workspaceId),
			eq(routingRules.enabled, true),
		),
		orderBy: [asc(routingRules.priority), asc(routingRules.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		workspaceId: r.workspaceId,
		name: r.name,
		enabled: r.enabled,
		priority: r.priority,
		conditions: parseRoutingConditions(r.conditions),
		action: parseRoutingAction(r.action),
	}));
}

async function pickRoundRobinAgent(
	workspaceId: string,
	agentIds: string[],
): Promise<string | null> {
	const pool =
		agentIds.length > 0
			? agentIds
			: (
					await db
						.select({ userId: workspaceMembers.userId })
						.from(workspaceMembers)
						.where(
							and(
								eq(workspaceMembers.workspaceId, workspaceId),
								eq(workspaceMembers.status, "active"),
								inArray(workspaceMembers.role, ["owner", "admin", "agent"]),
							),
						)
				).map((r) => r.userId);

	if (pool.length === 0) return null;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const routing = routingRoot(ws?.settings);
	const rr =
		routing.round_robin && typeof routing.round_robin === "object"
			? (routing.round_robin as Record<string, unknown>)
			: {};
	const poolKey = [...pool].sort().join(",");
	const lastIndex =
		typeof rr[poolKey] === "number" && Number.isFinite(rr[poolKey])
			? (rr[poolKey] as number)
			: -1;
	const nextIndex = (lastIndex + 1) % pool.length;
	const agentId = pool[nextIndex] ?? pool[0]!;

	const nextRr = { ...rr, [poolKey]: nextIndex };
	const settings =
		ws?.settings && typeof ws.settings === "object"
			? { ...(ws.settings as Record<string, unknown>) }
			: {};
	settings.routing = { ...routing, round_robin: nextRr };

	await db
		.update(workspaces)
		.set({ settings, updatedAt: new Date() })
		.where(eq(workspaces.id, workspaceId));

	return agentId;
}

async function emitAssigned(workspaceId: string, conversationId: string, agentId: string) {
	try {
		const { getIO } = await import("../../ws/broadcast.js");
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("conv:assigned", {
			conv_id: conversationId,
			agent_id: agentId,
			source: "routing",
		});
	} catch {
		/* socket not ready */
	}

	const conv = await db.query.conversations.findFirst({
		where: eq(conversations.id, conversationId),
		columns: { contactId: true },
	});
	if (conv) {
		const contact = await db.query.contacts.findFirst({
			where: eq(contacts.id, conv.contactId),
			columns: { fullName: true },
		});
		const { emailNotifyAssigned } = await import(
			"../email-notifications/index.js"
		);
		void emailNotifyAssigned(
			workspaceId,
			conversationId,
			agentId,
			contact?.fullName ?? null,
		);
	}
}

async function applyAction(
	workspaceId: string,
	conversationId: string,
	action: RoutingAction,
): Promise<boolean> {
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	switch (action.type) {
		case "assign_agent": {
			if (!action.agent_id) return false;
			const member = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.userId, action.agent_id),
					eq(workspaceMembers.status, "active"),
				),
			});
			if (!member) return false;
			updates.assignedAgentId = action.agent_id;
			break;
		}
		case "round_robin": {
			const agentId = await pickRoundRobinAgent(
				workspaceId,
				action.agent_ids ?? [],
			);
			if (!agentId) return false;
			updates.assignedAgentId = agentId;
			break;
		}
		case "enable_ai":
			updates.aiHandled = true;
			break;
		case "set_priority":
			if (action.priority == null) return false;
			updates.priority = action.priority;
			break;
		default:
			return false;
	}

	const [row] = await db
		.update(conversations)
		.set(updates)
		.where(
			and(
				eq(conversations.id, conversationId),
				eq(conversations.workspaceId, workspaceId),
			),
		)
		.returning();

	if (!row) return false;

	if (typeof updates.assignedAgentId === "string") {
		await emitAssigned(workspaceId, conversationId, updates.assignedAgentId);
	}

	return true;
}

export async function applyRoutingRules(ctx: RoutingContext): Promise<boolean> {
	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, ctx.conversationId),
			eq(conversations.workspaceId, ctx.workspaceId),
		),
		columns: {
			id: true,
			assignedAgentId: true,
			lastAgentReplyAt: true,
			status: true,
		},
	});

	if (!conv || conv.status !== "open") return false;
	if (conv.assignedAgentId || conv.lastAgentReplyAt) return false;

	const rules = await loadRules(ctx.workspaceId);
	for (const rule of rules) {
		if (!(await ruleMatches(rule.conditions, ctx))) continue;
		const applied = await applyAction(
			ctx.workspaceId,
			ctx.conversationId,
			rule.action,
		);
		if (applied) return true;
	}

	return false;
}
