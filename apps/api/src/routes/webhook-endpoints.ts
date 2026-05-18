import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { webhookDeliveries, webhookEndpoints } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import {
	isValidWebhookUrl,
	parseWebhookEvents,
} from "../lib/webhooks/index.js";
import { getWorkspaceId } from "../lib/workspace.js";

function maskSecret(secret: string) {
	if (secret.length <= 8) return "••••";
	return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

export async function webhookEndpointRoutes(app: FastifyInstance) {
	app.get(
		"/v1/webhook-endpoints",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.webhookEndpoints.findMany({
				where: eq(webhookEndpoints.workspaceId, wsId),
				orderBy: (t, { desc: d }) => [d(t.createdAt)],
			});
			return {
				data: rows.map((r) => ({
					id: r.id,
					workspaceId: r.workspaceId,
					name: r.name,
					url: r.url,
					secret_preview: maskSecret(r.secret),
					enabled: r.enabled,
					events: r.events,
					createdAt: r.createdAt,
					updatedAt: r.updatedAt,
				})),
			};
		},
	);

	app.post<{
		Body: { name?: string; url?: string; events?: unknown; enabled?: boolean };
	}>(
		"/v1/webhook-endpoints",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const name = request.body?.name?.trim() || "Webhook";
			const url = request.body?.url?.trim() ?? "";
			if (!isValidWebhookUrl(url)) {
				throw validationError("Invalid webhook URL.", "url");
			}
			const events = parseWebhookEvents(request.body?.events);
			const secret = randomBytes(32).toString("hex");

			const [row] = await db
				.insert(webhookEndpoints)
				.values({
					workspaceId: wsId,
					name,
					url,
					secret,
					events,
					enabled: request.body?.enabled !== false,
				})
				.returning();

			return reply.status(201).send({
				data: {
					...row,
					secret,
					secret_preview: maskSecret(secret),
				},
			});
		},
	);

	app.patch<{
		Params: { id: string };
		Body: {
			name?: string;
			url?: string;
			events?: unknown;
			enabled?: boolean;
		};
	}>(
		"/v1/webhook-endpoints/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.webhookEndpoints.findFirst({
				where: and(
					eq(webhookEndpoints.id, request.params.id),
					eq(webhookEndpoints.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Webhook endpoint not found.");

			const patch: Record<string, unknown> = { updatedAt: new Date() };
			if (request.body?.name?.trim()) patch.name = request.body.name.trim();
			if (request.body?.url !== undefined) {
				const url = request.body.url.trim();
				if (!isValidWebhookUrl(url)) {
					throw validationError("Invalid webhook URL.", "url");
				}
				patch.url = url;
			}
			if (request.body?.events !== undefined) {
				patch.events = parseWebhookEvents(request.body.events);
			}
			if (typeof request.body?.enabled === "boolean") {
				patch.enabled = request.body.enabled;
			}

			const [row] = await db
				.update(webhookEndpoints)
				.set(patch)
				.where(eq(webhookEndpoints.id, existing.id))
				.returning();

			return {
				data: {
					...row,
					secret: undefined,
					secret_preview: maskSecret(row!.secret),
				},
			};
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/webhook-endpoints/:id/rotate-secret",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.webhookEndpoints.findFirst({
				where: and(
					eq(webhookEndpoints.id, request.params.id),
					eq(webhookEndpoints.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Webhook endpoint not found.");

			const secret = randomBytes(32).toString("hex");
			const [row] = await db
				.update(webhookEndpoints)
				.set({ secret, updatedAt: new Date() })
				.where(eq(webhookEndpoints.id, existing.id))
				.returning();

			return {
				data: {
					...row,
					secret,
					secret_preview: maskSecret(secret),
				},
			};
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/webhook-endpoints/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const existing = await db.query.webhookEndpoints.findFirst({
				where: and(
					eq(webhookEndpoints.id, request.params.id),
					eq(webhookEndpoints.workspaceId, wsId),
				),
			});
			if (!existing) throw notFound("Webhook endpoint not found.");
			await db
				.delete(webhookEndpoints)
				.where(eq(webhookEndpoints.id, existing.id));
			return reply.status(204).send();
		},
	);

	app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
		"/v1/webhook-endpoints/:id/deliveries",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const limit = Math.min(Number(request.query.limit) || 30, 100);
			const endpoint = await db.query.webhookEndpoints.findFirst({
				where: and(
					eq(webhookEndpoints.id, request.params.id),
					eq(webhookEndpoints.workspaceId, wsId),
				),
				columns: { id: true },
			});
			if (!endpoint) throw notFound("Webhook endpoint not found.");

			const rows = await db.query.webhookDeliveries.findMany({
				where: eq(webhookDeliveries.endpointId, endpoint.id),
				orderBy: [desc(webhookDeliveries.createdAt)],
				limit,
			});

			return { data: rows };
		},
	);
}
