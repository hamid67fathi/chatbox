import { and, asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
	campaigns,
	companies,
	contactAttributeDefinitions,
	contactAttributeValues,
	contactCompanies,
	contactLifecycleHistory,
	contacts,
	proactiveRules,
} from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { buildContactJourney } from "../lib/contact-journey.js";
import { listAtRiskContacts } from "../lib/contact-health.js";
import {
	ensureDefaultScoringRules,
	recomputeContactScore,
} from "../lib/contact-scoring.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";
import { workspaces } from "../db/schema/index.js";

const LIFECYCLE_STAGES = [
	"new",
	"lead",
	"prospect",
	"customer",
	"vip",
	"at_risk",
	"churned",
	"reactivated",
] as const;

export async function crmFeatureRoutes(app: FastifyInstance) {
	app.get(
		"/v1/settings/contact-attributes",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.contactAttributeDefinitions.findMany({
				where: eq(contactAttributeDefinitions.workspaceId, wsId),
				orderBy: [asc(contactAttributeDefinitions.sortOrder)],
			});
			return { data: rows };
		},
	);

	app.post<{ Body: Record<string, unknown> }>(
		"/v1/settings/contact-attributes",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const key = typeof body.key === "string" ? body.key.trim() : "";
			const label = typeof body.label === "string" ? body.label.trim() : "";
			const type = typeof body.type === "string" ? body.type.trim() : "text";
			if (!key || !label) {
				throw validationError("key and label are required.");
			}
			const [row] = await db
				.insert(contactAttributeDefinitions)
				.values({
					workspaceId: wsId,
					key,
					label,
					type,
					options: Array.isArray(body.options) ? body.options : [],
					required: body.required === true,
					sortOrder: Number(body.sort_order) || 0,
				})
				.returning();
			return reply.status(201).send({ data: row });
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/settings/contact-attributes/:id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			await db
				.delete(contactAttributeDefinitions)
				.where(
					and(
						eq(contactAttributeDefinitions.id, request.params.id),
						eq(contactAttributeDefinitions.workspaceId, wsId),
					),
				);
			return reply.status(204).send();
		},
	);

	app.patch<{ Params: { id: string }; Body: { attributes?: Record<string, string> } }>(
		"/v1/contacts/:id/attributes",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const attrs = request.body?.attributes ?? {};
			const defs = await db.query.contactAttributeDefinitions.findMany({
				where: eq(contactAttributeDefinitions.workspaceId, wsId),
			});
			const byKey = new Map(defs.map((d) => [d.key, d]));

			for (const [key, value] of Object.entries(attrs)) {
				const def = byKey.get(key);
				if (!def) continue;
				await db
					.insert(contactAttributeValues)
					.values({
						contactId: request.params.id,
						definitionId: def.id,
						value: String(value),
					})
					.onConflictDoUpdate({
						target: [
							contactAttributeValues.contactId,
							contactAttributeValues.definitionId,
						],
						set: { value: String(value), updatedAt: new Date() },
					});
			}
			return { ok: true };
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/contacts/:id/attributes",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const values = await db.query.contactAttributeValues.findMany({
				where: eq(contactAttributeValues.contactId, request.params.id),
			});
			const defs = await db.query.contactAttributeDefinitions.findMany({
				where: eq(contactAttributeDefinitions.workspaceId, wsId),
			});
			const defMap = new Map(defs.map((d) => [d.id, d]));
			return {
				data: values.map((v) => ({
					key: defMap.get(v.definitionId)?.key,
					label: defMap.get(v.definitionId)?.label,
					value: v.value,
				})),
			};
		},
	);

	app.patch<{ Params: { id: string }; Body: { stage?: string; reason?: string } }>(
		"/v1/contacts/:id/lifecycle",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const stage = request.body?.stage?.trim();
			if (!stage || !LIFECYCLE_STAGES.includes(stage as (typeof LIFECYCLE_STAGES)[number])) {
				throw validationError("Invalid lifecycle stage.", "stage");
			}
			const contact = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.id, request.params.id),
					eq(contacts.workspaceId, wsId),
				),
			});
			if (!contact) throw notFound("Contact not found.");

			const user = (request as AuthenticatedRequest).user;
			await db
				.update(contacts)
				.set({ lifecycleStage: stage, updatedAt: new Date() })
				.where(eq(contacts.id, contact.id));

			await db.insert(contactLifecycleHistory).values({
				contactId: contact.id,
				workspaceId: wsId,
				fromStage: contact.lifecycleStage,
				toStage: stage,
				changedBy: user.id,
				reason: request.body?.reason ?? null,
			});

			return { data: { lifecycle_stage: stage } };
		},
	);

	app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
		"/v1/contacts/:id/journey",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
				columns: { plan: true },
			});
			if (!ws) throw notFound("Workspace not found.");
			const items = await buildContactJourney(wsId, request.params.id, {
				plan: ws.plan,
				from: request.query.from ? new Date(request.query.from) : undefined,
				to: request.query.to ? new Date(request.query.to) : undefined,
			});
			return { data: items };
		},
	);

	app.post<{ Params: { id: string } }>(
		"/v1/contacts/:id/score/recompute",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			await ensureDefaultScoringRules(wsId);
			const result = await recomputeContactScore(wsId, request.params.id);
			return { data: result };
		},
	);

	app.get(
		"/v1/reports/at-risk-contacts",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await listAtRiskContacts(wsId);
			return { data: rows };
		},
	);

	app.get(
		"/v1/proactive-rules",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.proactiveRules.findMany({
				where: eq(proactiveRules.workspaceId, wsId),
				orderBy: [desc(proactiveRules.createdAt)],
			});
			return { data: rows };
		},
	);

	app.post<{ Body: Record<string, unknown> }>(
		"/v1/proactive-rules",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const [row] = await db
				.insert(proactiveRules)
				.values({
					workspaceId: wsId,
					name: String(body.name ?? "Rule"),
					triggerType: String(body.trigger_type ?? "time_on_page"),
					conditions:
						body.conditions && typeof body.conditions === "object"
							? body.conditions
							: {},
					message: String(body.message ?? ""),
					throttleDays: Number(body.throttle_days) || 7,
					active: body.active !== false,
				})
				.returning();
			return reply.status(201).send({ data: row });
		},
	);

	app.get(
		"/v1/campaigns",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.campaigns.findMany({
				where: eq(campaigns.workspaceId, wsId),
				orderBy: [desc(campaigns.createdAt)],
			});
			return { data: rows };
		},
	);

	app.post<{ Body: Record<string, unknown> }>(
		"/v1/campaigns",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const [row] = await db
				.insert(campaigns)
				.values({
					workspaceId: wsId,
					name: String(body.name ?? "Campaign"),
					messageTemplate: String(body.message_template ?? ""),
					segmentId:
						typeof body.segment_id === "string" ? body.segment_id : null,
					status: "draft",
				})
				.returning();
			return reply.status(201).send({ data: row });
		},
	);

	app.get(
		"/v1/companies",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.companies.findMany({
				where: eq(companies.workspaceId, wsId),
				orderBy: [desc(companies.createdAt)],
			});
			return { data: rows };
		},
	);

	app.post<{ Body: Record<string, unknown> }>(
		"/v1/companies",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const [row] = await db
				.insert(companies)
				.values({
					workspaceId: wsId,
					name: String(body.name ?? "Company"),
					domain: typeof body.domain === "string" ? body.domain : null,
					industry: typeof body.industry === "string" ? body.industry : null,
					size: typeof body.size === "string" ? body.size : null,
					website: typeof body.website === "string" ? body.website : null,
				})
				.returning();
			return reply.status(201).send({ data: row });
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/companies/:id/contacts",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const links = await db.query.contactCompanies.findMany({
				where: eq(contactCompanies.companyId, request.params.id),
			});
			const ids = links.map((l) => l.contactId);
			if (ids.length === 0) return { data: [] };
			const rows = await db.query.contacts.findMany({
				where: and(eq(contacts.workspaceId, wsId)),
			});
			return {
				data: rows.filter((c) => ids.includes(c.id)),
			};
		},
	);

	app.get("/v1/widget/proactive-rules", async (request) => {
		const slug =
			typeof (request.query as { workspace_slug?: string }).workspace_slug ===
			"string"
				? (request.query as { workspace_slug: string }).workspace_slug
				: "";
		if (!slug) throw validationError("workspace_slug required.");
		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.slug, slug.trim()),
		});
		if (!ws) throw notFound("Workspace not found.");
		const rows = await db.query.proactiveRules.findMany({
			where: and(
				eq(proactiveRules.workspaceId, ws.id),
				eq(proactiveRules.active, true),
			),
		});
		return {
			data: rows.map((r) => ({
				id: r.id,
				trigger_type: r.triggerType,
				conditions: r.conditions,
				message: r.message,
				throttle_days: r.throttleDays,
			})),
		};
	});
}
