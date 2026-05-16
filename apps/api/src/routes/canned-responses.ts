import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { cannedResponses } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { applyCannedVariables, extractVariableNames } from "../lib/canned.js";
import { conflict, notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

function normalizeShortcut(raw: string): string {
	const s = raw.trim();
	if (!s) return s;
	return s.startsWith("/") ? s : `/${s}`;
}

export async function cannedResponseRoutes(app: FastifyInstance) {
	app.get(
		"/v1/canned-responses",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.cannedResponses.findMany({
				where: eq(cannedResponses.workspaceId, wsId),
				orderBy: (t, { asc }) => [asc(t.shortcut)],
			});
			return { data: rows };
		},
	);

	app.get<{ Querystring: { q?: string } }>(
		"/v1/canned-responses/search",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const rows = await db.query.cannedResponses.findMany({
				where: eq(cannedResponses.workspaceId, wsId),
				orderBy: (t, { asc }) => [asc(t.shortcut)],
			});
			const q = request.query.q?.trim().toLowerCase() ?? "";
			if (!q) return { data: rows };
			const filtered = rows.filter(
				(r) =>
					r.shortcut.toLowerCase().includes(q) ||
					r.title.toLowerCase().includes(q),
			);
			return { data: filtered };
		},
	);

	app.post<{
		Body: { shortcut: string; title: string; body: string };
	}>(
		"/v1/canned-responses",
		{ preHandler: [requireWorkspace("agent")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const { shortcut, title, body } = request.body ?? {};

			if (!shortcut?.trim())
				throw validationError("shortcut is required.", "shortcut");
			if (!title?.trim()) throw validationError("title is required.", "title");
			if (!body?.trim()) throw validationError("body is required.", "body");

			const normalized = normalizeShortcut(shortcut);
			const variables = extractVariableNames(body);

			try {
				const [row] = await db
					.insert(cannedResponses)
					.values({
						workspaceId: wsId,
						shortcut: normalized,
						title: title.trim(),
						body: body.trim(),
						variables,
						createdBy: user.id,
					})
					.returning();
				return reply.status(201).send(row);
			} catch (err: unknown) {
				if (
					err &&
					typeof err === "object" &&
					"code" in err &&
					err.code === "23505"
				) {
					throw conflict("Shortcut already exists in this workspace.");
				}
				throw err;
			}
		},
	);

	app.patch<{
		Params: { id: string };
		Body: { shortcut?: string; title?: string; body?: string };
	}>(
		"/v1/canned-responses/:id",
		{ preHandler: [requireWorkspace("agent")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const { shortcut, title, body } = request.body ?? {};
			const updates: Record<string, unknown> = {};

			if (shortcut !== undefined) {
				if (!shortcut.trim())
					throw validationError("shortcut cannot be empty.", "shortcut");
				updates.shortcut = normalizeShortcut(shortcut);
			}
			if (title !== undefined) {
				if (!title.trim()) throw validationError("title cannot be empty.", "title");
				updates.title = title.trim();
			}
			if (body !== undefined) {
				if (!body.trim()) throw validationError("body cannot be empty.", "body");
				updates.body = body.trim();
				updates.variables = extractVariableNames(body);
			}

			if (Object.keys(updates).length === 0) {
				throw validationError("No fields to update.");
			}

			try {
				const [row] = await db
					.update(cannedResponses)
					.set(updates)
					.where(
						and(
							eq(cannedResponses.id, request.params.id),
							eq(cannedResponses.workspaceId, wsId),
						),
					)
					.returning();
				if (!row) throw notFound("Canned response not found.");
				return row;
			} catch (err: unknown) {
				if (
					err &&
					typeof err === "object" &&
					"code" in err &&
					err.code === "23505"
				) {
					throw conflict("Shortcut already exists in this workspace.");
				}
				throw err;
			}
		},
	);

	app.delete<{ Params: { id: string } }>(
		"/v1/canned-responses/:id",
		{ preHandler: [requireWorkspace("agent")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const [row] = await db
				.delete(cannedResponses)
				.where(
					and(
						eq(cannedResponses.id, request.params.id),
						eq(cannedResponses.workspaceId, wsId),
					),
				)
				.returning();
			if (!row) throw notFound("Canned response not found.");
			return { ok: true };
		},
	);

	app.post<{
		Params: { id: string };
		Body: { variables?: Record<string, string> };
	}>(
		"/v1/canned-responses/:id/use",
		{ preHandler: [requireWorkspace("agent")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const vars = request.body?.variables ?? {};

			const [row] = await db
				.update(cannedResponses)
				.set({ usageCount: sql`${cannedResponses.usageCount} + 1` })
				.where(
					and(
						eq(cannedResponses.id, request.params.id),
						eq(cannedResponses.workspaceId, wsId),
					),
				)
				.returning();

			if (!row) throw notFound("Canned response not found.");

			return {
				body: applyCannedVariables(row.body, vars),
				shortcut: row.shortcut,
			};
		},
	);
}
