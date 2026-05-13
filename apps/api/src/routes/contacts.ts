import { and, eq, ilike, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { contacts } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function contactRoutes(app: FastifyInstance) {
	app.get<{ Querystring: { q?: string; limit?: string; cursor?: string } }>(
		"/v1/contacts",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const limit = Math.min(Number(request.query.limit) || 50, 100);
			const q = request.query.q;

			const conditions = [eq(contacts.workspaceId, wsId)];
			if (q) {
				const search = or(
					ilike(contacts.fullName, `%${q}%`),
					ilike(contacts.email, `%${q}%`),
					ilike(contacts.phone, `%${q}%`),
				);
				if (search) conditions.push(search);
			}

			const rows = await db.query.contacts.findMany({
				where: and(...conditions),
				limit,
				orderBy: (c, { desc }) => [desc(c.createdAt)],
			});

			return { data: rows };
		},
	);

	app.get<{ Params: { id: string } }>("/v1/contacts/:id", async (request) => {
		const wsId = getWorkspaceId(request);
		const row = await db.query.contacts.findFirst({
			where: and(
				eq(contacts.id, request.params.id),
				eq(contacts.workspaceId, wsId),
			),
		});
		if (!row) throw notFound("Contact not found.");
		return row;
	});

	app.post<{
		Body: {
			full_name?: string;
			email?: string;
			phone?: string;
			external_id?: string;
			metadata?: Record<string, unknown>;
		};
	}>("/v1/contacts", async (request, reply) => {
		const wsId = getWorkspaceId(request);
		const { full_name, email, phone, external_id, metadata } =
			request.body ?? {};

		if (!full_name && !email && !phone) {
			throw validationError(
				"At least one of full_name, email, or phone is required.",
			);
		}

		const [row] = await db
			.insert(contacts)
			.values({
				workspaceId: wsId,
				fullName: full_name,
				email,
				phone,
				externalId: external_id,
				metadata: metadata ?? {},
			})
			.returning();

		return reply.status(201).send(row);
	});

	app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
		"/v1/contacts/:id",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const updates: Record<string, unknown> = {};

			if (typeof body.full_name === "string") updates.fullName = body.full_name;
			if (typeof body.email === "string") updates.email = body.email;
			if (typeof body.phone === "string") updates.phone = body.phone;
			if (typeof body.external_id === "string")
				updates.externalId = body.external_id;
			if (body.metadata && typeof body.metadata === "object")
				updates.metadata = body.metadata;

			if (Object.keys(updates).length === 0) {
				throw validationError("No valid fields to update.");
			}

			const [updated] = await db
				.update(contacts)
				.set(updates)
				.where(
					and(
						eq(contacts.id, request.params.id),
						eq(contacts.workspaceId, wsId),
					),
				)
				.returning();

			if (!updated) throw notFound("Contact not found.");
			return updated;
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/contacts/:id",
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const [deleted] = await db
				.delete(contacts)
				.where(
					and(
						eq(contacts.id, request.params.id),
						eq(contacts.workspaceId, wsId),
					),
				)
				.returning();

			if (!deleted) throw notFound("Contact not found.");
			return reply.status(204).send();
		},
	);
}
