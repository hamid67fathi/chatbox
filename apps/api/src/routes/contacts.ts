import { and, eq, ilike, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { contacts } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
	applyContactBulkAction,
	exportContacts,
	importContacts,
	type BulkAction,
	type ImportRow,
} from "../lib/contact-bulk.js";
import { buildContactTimeline } from "../lib/contact-timeline.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import { identifyByVisitorId } from "../lib/identity-resolution.js";
import { listContactVisitorEvents } from "../lib/visitor-events.js";
import { getWorkspaceId } from "../lib/workspace.js";
import { workspaces } from "../db/schema/index.js";

const CHANNELS = new Set([
	"widget",
	"telegram",
	"email",
	"whatsapp",
	"api",
]);

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

	app.post<{ Body: BulkAction }>(
		"/v1/contacts/bulk",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const body = request.body;
			if (!body?.action) {
				throw validationError("action is required.", "action");
			}
			const result = await applyContactBulkAction(wsId, user.id, body);
			return { data: result };
		},
	);

	app.post<{ Body: { contact_ids?: string[] } }>(
		"/v1/contacts/export",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const ids = Array.isArray(request.body?.contact_ids)
				? request.body.contact_ids.filter((id): id is string => typeof id === "string")
				: undefined;
			const csv = await exportContacts(wsId, ids);
			const user = (request as AuthenticatedRequest).user;
			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.EXPORT_CONTACTS,
				targetType: "contacts",
				diff: { count: ids?.length ?? "all" },
			});
			return reply
				.header("Content-Type", "text/csv; charset=utf-8")
				.header(
					"Content-Disposition",
					'attachment; filename="contacts-export.csv"',
				)
				.send(csv);
		},
	);

	app.post<{ Body: { rows?: ImportRow[] } }>(
		"/v1/contacts/import",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const rows = request.body?.rows;
			if (!Array.isArray(rows) || rows.length === 0) {
				throw validationError("rows array is required.", "rows");
			}
			const result = await importContacts(wsId, rows);
			return reply.status(201).send({ data: result });
		},
	);

	app.post<{
		Body: {
			visitor_id?: string;
			email?: string;
			phone?: string;
			contact_id?: string;
		};
	}>(
		"/v1/contacts/identify",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const body = request.body ?? {};
			if (!body.visitor_id?.trim()) {
				throw validationError("visitor_id is required.", "visitor_id");
			}

			const result = await identifyByVisitorId(wsId, {
				visitor_id: body.visitor_id,
				email: body.email,
				phone: body.phone,
				contact_id: body.contact_id,
			});

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.CONTACT_IDENTIFY,
				targetType: "contact",
				targetId: result.contact_id,
				diff: {
					visitor_id: body.visitor_id,
					merged: result.merged,
				},
			});

			return reply.status(200).send({ data: result });
		},
	);

	app.get<{ Params: { id: string } }>(
		"/v1/contacts/:id",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const row = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.id, request.params.id),
					eq(contacts.workspaceId, wsId),
				),
			});
			if (!row) throw notFound("Contact not found.");
			return { data: row };
		},
	);

	app.get<{
		Params: { id: string };
		Querystring: { limit?: string; cursor?: string };
	}>(
		"/v1/contacts/:id/events",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
				columns: { plan: true },
			});
			if (!ws) throw notFound("Workspace not found.");

			const result = await listContactVisitorEvents(
				wsId,
				request.params.id,
				{
					plan: ws.plan,
					limit: Number(request.query.limit) || 50,
					cursor: request.query.cursor,
				},
			);

			return {
				data: result.rows,
				page: { next_cursor: result.next_cursor },
			};
		},
	);

	app.get<{
		Params: { id: string };
		Querystring: {
			channel?: string;
			from?: string;
			to?: string;
			limit?: string;
			cursor?: string;
		};
	}>(
		"/v1/contacts/:id/timeline",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const contact = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.id, request.params.id),
					eq(contacts.workspaceId, wsId),
				),
				columns: { id: true },
			});
			if (!contact) throw notFound("Contact not found.");

			const channel = request.query.channel?.trim();
			if (channel && !CHANNELS.has(channel)) {
				throw validationError("Invalid channel.", "channel");
			}

			const from = request.query.from
				? new Date(request.query.from)
				: undefined;
			const to = request.query.to ? new Date(request.query.to) : undefined;
			if (from && Number.isNaN(from.getTime())) {
				throw validationError("Invalid from date.", "from");
			}
			if (to && Number.isNaN(to.getTime())) {
				throw validationError("Invalid to date.", "to");
			}

			const result = await buildContactTimeline(wsId, contact.id, {
				channel,
				from,
				to,
				limit: Number(request.query.limit) || 50,
				cursor: request.query.cursor,
			});

			return { data: result };
		},
	);

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
