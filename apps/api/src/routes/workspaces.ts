import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaceMembers, workspaces } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { conflict, notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";

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
			});
			return { data: rows };
		},
	);
}
