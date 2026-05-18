import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { routingRules } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";
import { parseRoutingAction, parseRoutingConditions } from "../lib/routing/parse.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function routingRuleRoutes(app: FastifyInstance) {
	app.get(
		"/v1/routing-rules",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.routingRules.findMany({
				where: eq(routingRules.workspaceId, wsId),
				orderBy: [asc(routingRules.priority), asc(routingRules.createdAt)],
			});
			return { data: rows };
		},
	);

	app.post<{
		Body: {
			name?: string;
			priority?: number;
			conditions?: unknown;
			action?: unknown;
		};
	}>(
		"/v1/routing-rules",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const name = request.body?.name?.trim() || "قانون جدید";
			const priority =
				typeof request.body?.priority === "number"
					? Math.round(request.body.priority)
					: 100;
			const conditions = parseRoutingConditions(request.body?.conditions);
			const action = parseRoutingAction(request.body?.action);

			if (action.type === "assign_agent" && !action.agent_id) {
				throw validationError(
					"agent_id is required for assign_agent action.",
					"action",
				);
			}

			const [row] = await db
				.insert(routingRules)
				.values({
					workspaceId: wsId,
					name,
					priority,
					conditions,
					action,
				})
				.returning();

			return reply.status(201).send({ data: row });
		},
	);

	app.patch<{
		Params: { id: string };
		Body: {
			name?: string;
			enabled?: boolean;
			priority?: number;
			conditions?: unknown;
			action?: unknown;
		};
	}>(
		"/v1/routing-rules/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.routingRules.findFirst({
				where: and(
					eq(routingRules.id, request.params.id),
					eq(routingRules.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Routing rule not found.");

			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (typeof request.body?.name === "string" && request.body.name.trim()) {
				updates.name = request.body.name.trim();
			}
			if (typeof request.body?.enabled === "boolean") {
				updates.enabled = request.body.enabled;
			}
			if (typeof request.body?.priority === "number") {
				updates.priority = Math.round(request.body.priority);
			}
			if (request.body?.conditions !== undefined) {
				updates.conditions = parseRoutingConditions(request.body.conditions);
			}
			if (request.body?.action !== undefined) {
				const action = parseRoutingAction(request.body.action);
				if (action.type === "assign_agent" && !action.agent_id) {
					throw validationError(
						"agent_id is required for assign_agent action.",
						"action",
					);
				}
				updates.action = action;
			}

			const [row] = await db
				.update(routingRules)
				.set(updates)
				.where(eq(routingRules.id, request.params.id))
				.returning();

			return { data: row };
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/routing-rules/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.routingRules.findFirst({
				where: and(
					eq(routingRules.id, request.params.id),
					eq(routingRules.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Routing rule not found.");

			await db.delete(routingRules).where(eq(routingRules.id, request.params.id));
			return { ok: true };
		},
	);
}
