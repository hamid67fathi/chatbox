import { and, eq, isNull, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations, workspaceMembers } from "../db/schema/index.js";
import { forbidden } from "./auth.js";

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer";

export function isSupervisorRole(role: WorkspaceRole): boolean {
	return role === "owner" || role === "admin";
}

/** Shared inbox pool: no assignee and no human agent reply yet. */
export function unclaimedInboxCondition() {
	return and(
		isNull(conversations.assignedAgentId),
		isNull(conversations.lastAgentReplyAt),
	);
}

/** Agents/viewers only see unclaimed pool + conversations assigned to them. */
export function agentInboxVisibilityCondition(userId: string): SQL {
	return or(unclaimedInboxCondition(), eq(conversations.assignedAgentId, userId))!;
}

export async function getWorkspaceRole(
	workspaceId: string,
	userId: string,
): Promise<WorkspaceRole | null> {
	const [row] = await db
		.select({ role: workspaceMembers.role })
		.from(workspaceMembers)
		.where(
			and(
				eq(workspaceMembers.workspaceId, workspaceId),
				eq(workspaceMembers.userId, userId),
			),
		)
		.limit(1);
	return (row?.role as WorkspaceRole) ?? null;
}

export type ConversationAccessRow = {
	assignedAgentId: string | null;
	lastAgentReplyAt: Date | null;
};

export function canAccessConversation(
	conv: ConversationAccessRow,
	userId: string,
	role: WorkspaceRole,
): boolean {
	if (isSupervisorRole(role)) return true;
	const unclaimed = !conv.assignedAgentId && !conv.lastAgentReplyAt;
	if (unclaimed) return true;
	return conv.assignedAgentId === userId;
}

export async function assertConversationAccess(
	conv: ConversationAccessRow,
	workspaceId: string,
	userId: string,
): Promise<WorkspaceRole> {
	const role = await getWorkspaceRole(workspaceId, userId);
	if (!role) throw forbidden("You are not a member of this workspace.");
	if (!canAccessConversation(conv, userId, role)) {
		throw forbidden("This conversation is assigned to another agent.");
	}
	return role;
}

/** First agent reply claims the conversation for that agent. */
export async function claimConversationForAgent(
	conversationId: string,
	workspaceId: string,
	agentUserId: string,
): Promise<void> {
	const [updated] = await db
		.update(conversations)
		.set({ assignedAgentId: agentUserId, updatedAt: new Date() })
		.where(
			and(
				eq(conversations.id, conversationId),
				eq(conversations.workspaceId, workspaceId),
			),
		)
		.returning({ id: conversations.id, assignedAgentId: conversations.assignedAgentId });

	if (!updated) return;

	try {
		const { getIO } = await import("../ws/broadcast.js");
		const io = getIO();
		io.to(`workspace:${workspaceId}`).emit("conv:assigned", {
			conv_id: conversationId,
			agent_id: agentUserId,
		});
	} catch {
		/* socket.io not initialized */
	}
}
