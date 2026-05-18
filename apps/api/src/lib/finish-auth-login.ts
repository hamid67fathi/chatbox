import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import {
	createAuthSession,
	ensureDemoWorkspaceMembership,
} from "./auth-sessions.js";
import { signAccessToken } from "./auth.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "./audit-log.js";
import { clientIpFromRequest } from "./dashboard-ip-access.js";
import { notifySuspiciousDashboardLogin } from "./suspicious-login-alerts.js";

export interface AuthLoginResult {
	access_token: string;
	refresh_token: string;
	session_id: string;
	user: {
		id: string;
		email: string | null;
		full_name: string | null;
		workspaces: { id: string; role: string }[];
	};
}

export async function finishAuthLogin(
	request: FastifyRequest,
	user: {
		id: string;
		email: string;
		fullName: string | null;
	},
	auditAction: string = AUDIT_ACTIONS.AUTH_LOGIN,
): Promise<AuthLoginResult> {
	await db
		.update(users)
		.set({ lastLoginAt: new Date() })
		.where(eq(users.id, user.id));

	const accessToken = await signAccessToken(user.id, user.email);
	const { refreshToken, sessionId } = await createAuthSession(
		user.id,
		request.headers["user-agent"],
		request.ip,
	);

	const memberships = await ensureDemoWorkspaceMembership(user.id);

	auditLogFromRequest(request, {
		workspaceId: memberships[0]?.workspaceId ?? null,
		actorUserId: user.id,
		action: auditAction,
		targetType: "user",
		targetId: user.id,
	});

	void notifySuspiciousDashboardLogin(user.id, clientIpFromRequest(request));

	return {
		access_token: accessToken,
		refresh_token: refreshToken,
		session_id: sessionId,
		user: {
			id: user.id,
			email: user.email,
			full_name: user.fullName,
			workspaces: memberships.map((m) => ({
				id: m.workspaceId,
				role: m.role,
			})),
		},
	};
}
