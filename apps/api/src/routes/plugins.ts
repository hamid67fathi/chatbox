import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { installedPlugins, pluginCatalog } from "../db/schema/index.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
	installWorkspacePlugin,
	uninstallWorkspacePlugin,
} from "../lib/plugins/install.js";
import { notFound } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

function mapCatalogRow(
	c: typeof pluginCatalog.$inferSelect,
	installed?: typeof installedPlugins.$inferSelect | null,
) {
	return {
		slug: c.slug,
		name: c.name,
		description: c.description,
		category: c.category,
		icon: c.icon,
		integration_type: c.integrationType,
		setup_path: c.setupPath,
		docs_url: c.docsUrl,
		default_events: c.defaultEvents,
		installed: Boolean(installed),
		enabled: installed?.enabled ?? false,
		webhook_endpoint_id: installed?.webhookEndpointId ?? null,
		installed_at: installed?.installedAt?.toISOString() ?? null,
	};
}

export async function pluginRoutes(app: FastifyInstance) {
	app.get(
		"/v1/plugins",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const catalog = await db.query.pluginCatalog.findMany({
				orderBy: [asc(pluginCatalog.sortOrder)],
			});
			const installed = await db.query.installedPlugins.findMany({
				where: eq(installedPlugins.workspaceId, wsId),
			});
			const bySlug = new Map(installed.map((r) => [r.pluginSlug, r]));

			return {
				data: catalog.map((c) => mapCatalogRow(c, bySlug.get(c.slug) ?? null)),
			};
		},
	);

	app.post<{
		Params: { slug: string };
		Body: { webhook_url?: string; enabled?: boolean };
	}>(
		"/v1/plugins/:slug/install",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const slug = request.params.slug.trim();

			const row = await installWorkspacePlugin(wsId, slug, {
				webhook_url: request.body?.webhook_url,
				enabled: request.body?.enabled,
			});

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.PLUGIN_INSTALL,
				targetType: "plugin",
				targetId: slug,
				diff: { webhook_endpoint_id: row.webhookEndpointId },
			});

			const catalog = await db.query.pluginCatalog.findFirst({
				where: eq(pluginCatalog.slug, slug),
			});
			if (!catalog) throw new Error("Catalog row missing after install.");

			return reply.status(201).send({
				data: mapCatalogRow(catalog, row),
			});
		},
	);

	app.delete<{ Params: { slug: string } }>(
		"/v1/plugins/:slug/install",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const slug = request.params.slug.trim();

			await uninstallWorkspacePlugin(wsId, slug);

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.PLUGIN_UNINSTALL,
				targetType: "plugin",
				targetId: slug,
			});

			return { ok: true };
		},
	);

	app.patch<{
		Params: { slug: string };
		Body: { enabled?: boolean };
	}>(
		"/v1/plugins/:slug",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const slug = request.params.slug.trim();

			const existing = await db.query.installedPlugins.findFirst({
				where: and(
					eq(installedPlugins.workspaceId, wsId),
					eq(installedPlugins.pluginSlug, slug),
				),
			});
			if (!existing) throw notFound("Plugin is not installed.");

			const enabled = request.body?.enabled;
			const [updated] = await db
				.update(installedPlugins)
				.set({
					...(typeof enabled === "boolean" ? { enabled } : {}),
					updatedAt: new Date(),
				})
				.where(eq(installedPlugins.id, existing.id))
				.returning();

			const catalog = await db.query.pluginCatalog.findFirst({
				where: eq(pluginCatalog.slug, slug),
			});
			if (!catalog || !updated) throw notFound("Plugin not found.");

			return { data: mapCatalogRow(catalog, updated) };
		},
	);
}
