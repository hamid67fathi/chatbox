import { and, eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { workspaceMembers } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "./auth.js";
import { forbidden, unauthorized } from "./auth.js";

type Role = "owner" | "admin" | "agent" | "viewer";

const ROLE_HIERARCHY: Record<Role, number> = {
	owner: 40,
	admin: 30,
	agent: 20,
	viewer: 10,
};

export interface WorkspaceRequest extends FastifyRequest {
	user: { id: string; email: string };
	workspace: { id: string; role: Role };
}

/**
 * Creates a preHandler that verifies the user belongs to the workspace
 * specified in the X-Workspace-Id header and has at least `minRole`.
 */
export function requireWorkspace(minRole: Role = "viewer") {
	return async function handler(
		request: FastifyRequest,
		_reply: FastifyReply,
	): Promise<void> {
		const wsId = request.headers["x-workspace-id"];
		if (!wsId || typeof wsId !== "string") {
			throw forbidden("X-Workspace-Id header is required.");
		}

		const authReq = request as AuthenticatedRequest;
		const userId = authReq.user?.id;
		if (!userId) throw unauthorized();

		if (authReq.apiToken) {
			if (authReq.apiToken.workspaceId !== wsId) {
				throw forbidden("API token is not valid for this workspace.");
			}
			const [membership] = await db
				.select({ role: workspaceMembers.role })
				.from(workspaceMembers)
				.where(
					and(
						eq(workspaceMembers.workspaceId, wsId),
						eq(workspaceMembers.userId, userId),
					),
				)
				.limit(1);
			if (!membership) throw forbidden("Token creator is not a workspace member.");
			const userLevel = ROLE_HIERARCHY[membership.role as Role] ?? 0;
			const minLevel = ROLE_HIERARCHY[minRole];
			if (userLevel < minLevel)
				throw forbidden(`Requires at least ${minRole} role.`);
			(request as WorkspaceRequest).workspace = {
				id: wsId,
				role: membership.role as Role,
			};
			return;
		}

		const [membership] = await db
			.select({ role: workspaceMembers.role })
			.from(workspaceMembers)
			.where(
				and(
					eq(workspaceMembers.workspaceId, wsId),
					eq(workspaceMembers.userId, userId),
				),
			)
			.limit(1);

		if (!membership) throw forbidden("You are not a member of this workspace.");

		const userLevel = ROLE_HIERARCHY[membership.role as Role] ?? 0;
		const minLevel = ROLE_HIERARCHY[minRole];
		if (userLevel < minLevel)
			throw forbidden(`Requires at least ${minRole} role.`);

		(request as WorkspaceRequest).workspace = {
			id: wsId,
			role: membership.role as Role,
		};
	};
}
