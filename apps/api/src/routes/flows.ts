import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { flows } from "../db/schema/index.js";
import { parseFlowDefinition } from "../lib/flow-engine/parse.js";
import { DEFAULT_FLOW_DEFINITION } from "../lib/flow-engine/types.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function flowRoutes(app: FastifyInstance) {
	app.get(
		"/v1/flows",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.flows.findMany({
				where: eq(flows.workspaceId, wsId),
				orderBy: [desc(flows.updatedAt)],
			});
			return { data: rows };
		},
	);

	app.post<{ Body: { name?: string; trigger?: string } }>(
		"/v1/flows",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const name = request.body?.name?.trim() || "جریان جدید";
			const trigger = request.body?.trigger?.trim() || "widget_start";

			const [row] = await db
				.insert(flows)
				.values({
					workspaceId: wsId,
					name,
					trigger,
					status: "draft",
					definition: DEFAULT_FLOW_DEFINITION,
				})
				.returning();

			return reply.status(201).send({ data: row });
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/flows/:id",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const row = await db.query.flows.findFirst({
				where: and(
					eq(flows.id, request.params.id),
					eq(flows.workspaceId, wsId),
				),
			});
			if (!row) throw notFound("Flow not found.");
			return { data: row };
		},
	);

	app.patch<{
		Params: { id: string };
		Body: { name?: string; definition?: unknown };
	}>(
		"/v1/flows/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.flows.findFirst({
				where: and(
					eq(flows.id, request.params.id),
					eq(flows.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Flow not found.");

			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (typeof request.body?.name === "string" && request.body.name.trim()) {
				updates.name = request.body.name.trim();
			}
			if (request.body?.definition !== undefined) {
				const def = parseFlowDefinition(request.body.definition);
				if (def.nodes.length === 0) {
					throw validationError("Flow must have at least one node.", "definition");
				}
				updates.definition = def;
			}

			const [row] = await db
				.update(flows)
				.set(updates)
				.where(eq(flows.id, request.params.id))
				.returning();

			return { data: row };
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/flows/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.flows.findFirst({
				where: and(
					eq(flows.id, request.params.id),
					eq(flows.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Flow not found.");

			await db.delete(flows).where(eq(flows.id, request.params.id));
			return { ok: true };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/flows/:id/publish",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.flows.findFirst({
				where: and(
					eq(flows.id, request.params.id),
					eq(flows.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Flow not found.");

			const now = new Date();
			await db
				.update(flows)
				.set({ status: "draft", updatedAt: now })
				.where(
					and(
						eq(flows.workspaceId, wsId),
						eq(flows.trigger, existing.trigger),
						eq(flows.status, "published"),
					),
				);

			const [row] = await db
				.update(flows)
				.set({
					status: "published",
					publishedAt: now,
					updatedAt: now,
				})
				.where(eq(flows.id, request.params.id))
				.returning();

			return { data: row };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/flows/:id/unpublish",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const [row] = await db
				.update(flows)
				.set({ status: "draft", updatedAt: new Date() })
				.where(
					and(
						eq(flows.id, request.params.id),
						eq(flows.workspaceId, wsId),
					),
				)
				.returning();
			if (!row) throw notFound("Flow not found.");
			return { data: row };
		},
	);
}
