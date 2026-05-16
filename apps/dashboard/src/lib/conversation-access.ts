import type { Conversation } from "./api";

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer";

export function isSupervisorRole(role?: string): boolean {
	return role === "owner" || role === "admin";
}

/** Matches API inbox visibility for agents. */
export function canAgentSeeConversation(
	conv: Pick<Conversation, "assignedAgentId" | "lastAgentReplyAt">,
	userId: string,
	role?: string,
): boolean {
	if (isSupervisorRole(role)) return true;
	const unclaimed = !conv.assignedAgentId && !conv.lastAgentReplyAt;
	if (unclaimed) return true;
	return conv.assignedAgentId === userId;
}
