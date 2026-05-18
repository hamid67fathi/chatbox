import { parseSegmentFilters } from "@chatbox/shared/segments";
import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { contactSegments } from "../db/schema/index.js";
import { notFound } from "../lib/errors.js";
import {
	countSegmentMembers,
	previewSegmentMembers,
} from "../lib/segments/index.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function contactSegmentRoutes(app: FastifyInstance) {
	app.get(
		"/v1/contact-segments",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.contactSegments.findMany({
				where: eq(contactSegments.workspaceId, wsId),
				orderBy: [asc(contactSegments.name)],
			});
			return { data: rows };
		},
	);

	app.post<{
		Body: {
			name?: string;
			description?: string;
			filters?: unknown;
			is_dynamic?: boolean;
		};
	}>(
		"/v1/contact-segments",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const name = request.body?.name?.trim() || "بخش جدید";
			const description = request.body?.description?.trim() || null;
			const filters = parseSegmentFilters(request.body?.filters);
			const isDynamic = request.body?.is_dynamic !== false;

			const [row] = await db
				.insert(contactSegments)
				.values({
					workspaceId: wsId,
					name,
					description,
					filters,
					isDynamic,
				})
				.returning();

			return reply.status(201).send({ data: row });
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/contact-segments/:id/preview",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const row = await db.query.contactSegments.findFirst({
				where: and(
					eq(contactSegments.id, request.params.id),
					eq(contactSegments.workspaceId, wsId),
				),
			});
			if (!row) throw notFound("Segment not found.");

			const filters = parseSegmentFilters(row.filters);
			const [count, sample] = await Promise.all([
				countSegmentMembers(wsId, filters),
				previewSegmentMembers(wsId, filters, 8),
			]);

			return { data: { count, sample } };
		},
	);

	app.post<{ Params: { id: string }; Body: { filters?: unknown } }>(
		"/v1/contact-segments/:id/preview",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const filters = parseSegmentFilters(request.body?.filters);
			if (!Object.keys(filters).length) {
				const row = await db.query.contactSegments.findFirst({
					where: and(
						eq(contactSegments.id, request.params.id),
						eq(contactSegments.workspaceId, wsId),
					),
				});
				if (!row) throw notFound("Segment not found.");
				Object.assign(filters, parseSegmentFilters(row.filters));
			}

			const [count, sample] = await Promise.all([
				countSegmentMembers(wsId, filters),
				previewSegmentMembers(wsId, filters, 8),
			]);

			return { data: { count, sample } };
		},
	);

	app.patch<{
		Params: { id: string };
		Body: {
			name?: string;
			description?: string;
			filters?: unknown;
			is_dynamic?: boolean;
		};
	}>(
		"/v1/contact-segments/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.contactSegments.findFirst({
				where: and(
					eq(contactSegments.id, request.params.id),
					eq(contactSegments.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Segment not found.");

			const patch: Record<string, unknown> = { updatedAt: new Date() };
			if (request.body?.name?.trim()) patch.name = request.body.name.trim();
			if (request.body?.description !== undefined) {
				patch.description = request.body.description?.trim() || null;
			}
			if (request.body?.filters !== undefined) {
				patch.filters = parseSegmentFilters(request.body.filters);
			}
			if (typeof request.body?.is_dynamic === "boolean") {
				patch.isDynamic = request.body.is_dynamic;
			}

			const [row] = await db
				.update(contactSegments)
				.set(patch)
				.where(eq(contactSegments.id, existing.id))
				.returning();

			return { data: row };
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/contact-segments/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.contactSegments.findFirst({
				where: and(
					eq(contactSegments.id, request.params.id),
					eq(contactSegments.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Segment not found.");

			await db
				.delete(contactSegments)
				.where(eq(contactSegments.id, existing.id));

			return reply.status(204).send();
		},
	);
}
