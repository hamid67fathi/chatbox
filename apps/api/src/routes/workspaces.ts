import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import { users, workspaceMembers, workspaces } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { forbidden, hashPassword } from "../lib/auth.js";
import { conflict, notFound, validationError } from "../lib/errors.js";
import { getAiBudgetStatus } from "../lib/ai-budget.js";
import {
	assertCanInviteMember,
	getPlanUsageStatus,
} from "../lib/plan-limits.js";
import { presenceCounts } from "../lib/presence.js";
import { listOnlineVisitors } from "../lib/visitor-presence.js";
import { requireWorkspace } from "../lib/rbac.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_ROLES = new Set(["admin", "agent", "viewer"]);

export async function workspaceRoutes(app: FastifyInstance) {
	app.post<{
		Body: { name: string; slug: string; locale?: string; timezone?: string };
	}>("/v1/workspaces", async (request, reply) => {
		const userId = (request as AuthenticatedRequest).user.id;
		const { name, slug, locale, timezone } = request.body ?? {};
		if (!name) throw validationError("name is required.", "name");
		if (!slug) throw validationError("slug is required.", "slug");

		const existing = await db.query.workspaces.findFirst({
			where: eq(workspaces.slug, slug),
		});
		if (existing) throw conflict(`Workspace slug "${slug}" already exists.`);

		const [ws] = await db
			.insert(workspaces)
			.values({
				name,
				slug,
				ownerUserId: userId,
				...(locale ? { locale } : {}),
				...(timezone ? { timezone } : {}),
			})
			.returning();

		await db.insert(workspaceMembers).values({
			workspaceId: ws.id,
			userId,
			role: "owner",
			status: "active",
			joinedAt: new Date(),
		});

		return reply.status(201).send(ws);
	});

	app.get("/v1/workspaces", async (request) => {
		const userId = (request as AuthenticatedRequest).user.id;

		const rows = await db
			.select({
				id: workspaces.id,
				name: workspaces.name,
				slug: workspaces.slug,
				plan: workspaces.plan,
				locale: workspaces.locale,
				timezone: workspaces.timezone,
				role: workspaceMembers.role,
			})
			.from(workspaceMembers)
			.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
			.where(eq(workspaceMembers.userId, userId))
			.limit(50);

		return { data: rows };
	});

	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, request.params.id),
			});
			if (!ws) throw notFound("Workspace not found.");
			return ws;
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/ai-usage",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const status = await getAiBudgetStatus(request.params.id);
			if (!status) throw notFound("Workspace not found.");
			return { data: status };
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/plan-usage",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const status = await getPlanUsageStatus(request.params.id);
			if (!status) throw notFound("Workspace not found.");
			return { data: status };
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/presence",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const counts = await presenceCounts(request.params.id);
			return { data: counts };
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/presence/visitors",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const rows = await listOnlineVisitors(request.params.id);
			return { data: rows };
		},
	);

	app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
		"/v1/workspaces/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const { name, locale, timezone } = request.body ?? {};
			const updates: Record<string, unknown> = {};
			if (typeof name === "string") updates.name = name;
			if (typeof locale === "string") updates.locale = locale;
			if (typeof timezone === "string") updates.timezone = timezone;

			if (Object.keys(updates).length === 0) {
				throw validationError("No valid fields to update.");
			}

			const [updated] = await db
				.update(workspaces)
				.set(updates)
				.where(eq(workspaces.id, request.params.id))
				.returning();

			if (!updated) throw notFound("Workspace not found.");
			return updated;
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/members",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const rows = await db.query.workspaceMembers.findMany({
				where: eq(workspaceMembers.workspaceId, request.params.id),
				with: { user: true },
			});
			return {
				data: rows.map((m) => ({
					userId: m.userId,
					role: m.role,
					status: m.status,
					email: m.user?.email ?? null,
					fullName: m.user?.fullName ?? null,
					avatarUrl: m.user?.avatarUrl ?? null,
					joinedAt: m.joinedAt,
				})),
			};
		},
	);

	app.post<{
		Params: { id: string };
		Body: { email: string; role: string; full_name?: string; password?: string };
	}>(
		"/v1/workspaces/:id/members/invite",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = request.params.id;
			const inviter = (request as AuthenticatedRequest).user;
			const { email, role, full_name, password } = request.body ?? {};

			if (!email || !EMAIL_RE.test(email)) {
				throw validationError("A valid email is required.", "email");
			}
			if (!role || !INVITE_ROLES.has(role)) {
				throw validationError(
					"role must be admin, agent, or viewer.",
					"role",
				);
			}

			const normalizedEmail = email.toLowerCase();

			let targetUser = await db.query.users.findFirst({
				where: eq(users.email, normalizedEmail),
			});

			let temporaryPassword: string | undefined;
			if (!targetUser) {
				temporaryPassword =
					password?.trim() ||
					randomBytes(9).toString("base64url").slice(0, 12);
				const hashed = await hashPassword(temporaryPassword);
				[targetUser] = await db
					.insert(users)
					.values({
						email: normalizedEmail,
						passwordHash: hashed,
						fullName: full_name?.trim() || null,
						emailVerified: false,
					})
					.returning();
			}

			const existingMember = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(workspaceMembers.workspaceId, wsId),
					eq(workspaceMembers.userId, targetUser.id),
				),
			});
			if (existingMember) {
				throw conflict("User is already a member of this workspace.");
			}

			await assertCanInviteMember(wsId);

			await db.insert(workspaceMembers).values({
				workspaceId: wsId,
				userId: targetUser.id,
				role: role as "agent",
				status: "active",
				invitedBy: inviter.id,
				joinedAt: new Date(),
			});

			return reply.status(201).send({
				member: {
					userId: targetUser.id,
					email: targetUser.email,
					fullName: targetUser.fullName,
					role,
					status: "active",
				},
				...(temporaryPassword
					? { temporary_password: temporaryPassword, user_created: true }
					: { user_created: false }),
			});
		},
	);

	app.patch<{
		Params: { id: string; userId: string };
		Body: { role?: string };
	}>(
		"/v1/workspaces/:id/members/:userId",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = request.params.id;
			const targetUserId = request.params.userId;
			const { role } = request.body ?? {};

			if (!role || !INVITE_ROLES.has(role)) {
				throw validationError(
					"role must be admin, agent, or viewer.",
					"role",
				);
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			if (ws.ownerUserId === targetUserId) {
				throw forbidden("Cannot change the workspace owner's role.");
			}

			const [updated] = await db
				.update(workspaceMembers)
				.set({ role: role as "agent" })
				.where(
					and(
						eq(workspaceMembers.workspaceId, wsId),
						eq(workspaceMembers.userId, targetUserId),
					),
				)
				.returning();

			if (!updated) throw notFound("Member not found.");
			return { ok: true, role: updated.role };
		},
	);

	app.delete<{ Params: { id: string; userId: string } }>(
		"/v1/workspaces/:id/members/:userId",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = request.params.id;
			const targetUserId = request.params.userId;
			const actor = (request as AuthenticatedRequest).user;

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			if (ws.ownerUserId === targetUserId) {
				throw forbidden("Cannot remove the workspace owner.");
			}
			if (targetUserId === actor.id) {
				throw forbidden("You cannot remove yourself. Ask another admin.");
			}

			const [removed] = await db
				.delete(workspaceMembers)
				.where(
					and(
						eq(workspaceMembers.workspaceId, wsId),
						eq(workspaceMembers.userId, targetUserId),
					),
				)
				.returning();

			if (!removed) throw notFound("Member not found.");
			return { ok: true };
		},
	);
}
