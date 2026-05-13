import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaceMembers, workspaces } from "../db/schema/index.js";
import { conflict, notFound, validationError } from "../lib/errors.js";

export async function workspaceRoutes(app: FastifyInstance) {
	app.post<{
		Body: { name: string; slug: string; locale?: string; timezone?: string };
	}>("/v1/workspaces", async (request, reply) => {
		const { name, slug, locale, timezone } = request.body ?? {};
		if (!name) throw validationError("name is required.", "name");
		if (!slug) throw validationError("slug is required.", "slug");

		const existing = await db.query.workspaces.findFirst({
			where: eq(workspaces.slug, slug),
		});
		if (existing) throw conflict(`Workspace slug "${slug}" already exists.`);

		// TODO: use authenticated user id instead of a placeholder
		const [ws] = await db
			.insert(workspaces)
			.values({
				name,
				slug,
				ownerUserId: "00000000-0000-0000-0000-000000000000",
				...(locale ? { locale } : {}),
				...(timezone ? { timezone } : {}),
			})
			.returning();

		return reply.status(201).send(ws);
	});

	app.get("/v1/workspaces", async () => {
		// TODO: filter by authenticated user membership
		const rows = await db.query.workspaces.findMany({
			limit: 50,
		});
		return { data: rows };
	});

	app.get<{ Params: { id: string } }>("/v1/workspaces/:id", async (request) => {
		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, request.params.id),
		});
		if (!ws) throw notFound("Workspace not found.");
		return ws;
	});

	app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
		"/v1/workspaces/:id",
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
		async (request) => {
			const rows = await db.query.workspaceMembers.findMany({
				where: eq(workspaceMembers.workspaceId, request.params.id),
			});
			return { data: rows };
		},
	);
}
