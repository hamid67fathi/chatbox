import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	sessions,
	workspaceMembers,
	workspaces,
} from "../db/schema/index.js";
import { signRefreshToken } from "./auth.js";

const REFRESH_DAYS = 7;

export async function loadUserWorkspaces(userId: string) {
	return db
		.select({
			workspaceId: workspaceMembers.workspaceId,
			role: workspaceMembers.role,
		})
		.from(workspaceMembers)
		.where(eq(workspaceMembers.userId, userId));
}

/** Ensures dev users can access the demo workspace inbox. */
export async function ensureDemoWorkspaceMembership(userId: string) {
	let memberships = await loadUserWorkspaces(userId);
	if (memberships.length > 0) return memberships;

	const demo = await db.query.workspaces.findFirst({
		where: eq(workspaces.slug, "demo"),
	});
	if (!demo) return memberships;

	await db
		.insert(workspaceMembers)
		.values({
			workspaceId: demo.id,
			userId,
			role: "agent",
			status: "active",
			joinedAt: new Date(),
		})
		.onConflictDoNothing();

	memberships = await loadUserWorkspaces(userId);
	return memberships;
}

export async function createAuthSession(
	userId: string,
	userAgent?: string,
	ip?: string,
): Promise<{ refreshToken: string; sessionId: string }> {
	const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400_000);

	const [session] = await db
		.insert(sessions)
		.values({
			userId,
			refreshToken: "pending",
			userAgent: userAgent ?? null,
			ipAddress: ip ?? null,
			expiresAt,
		})
		.returning({ id: sessions.id });

	const refreshToken = await signRefreshToken(userId, session.id);
	await db
		.update(sessions)
		.set({ refreshToken })
		.where(eq(sessions.id, session.id));

	return { refreshToken, sessionId: session.id };
}
