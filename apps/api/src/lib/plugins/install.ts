import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
	installedPlugins,
	pluginCatalog,
	webhookEndpoints,
} from "../../db/schema/index.js";
import { notFound, validationError } from "../errors.js";
import { isValidWebhookUrl, parseWebhookEvents } from "../webhooks/index.js";

export async function installWorkspacePlugin(
	workspaceId: string,
	slug: string,
	opts?: { webhook_url?: string; enabled?: boolean },
): Promise<typeof installedPlugins.$inferSelect> {
	const catalog = await db.query.pluginCatalog.findFirst({
		where: eq(pluginCatalog.slug, slug),
	});
	if (!catalog) throw notFound("Plugin not found.");

	const existing = await db.query.installedPlugins.findFirst({
		where: and(
			eq(installedPlugins.workspaceId, workspaceId),
			eq(installedPlugins.pluginSlug, slug),
		),
	});
	if (existing) return existing;

	let webhookEndpointId: string | null = null;
	const webhookUrl = opts?.webhook_url?.trim();
	if (webhookUrl) {
		if (!isValidWebhookUrl(webhookUrl)) {
			throw validationError("Invalid webhook URL.", "webhook_url");
		}
		const secret = randomBytes(32).toString("hex");
		const events = parseWebhookEvents(catalog.defaultEvents);
		const [endpoint] = await db
			.insert(webhookEndpoints)
			.values({
				workspaceId,
				name: catalog.name,
				url: webhookUrl,
				secret,
				events,
				enabled: opts?.enabled !== false,
			})
			.returning();
		webhookEndpointId = endpoint?.id ?? null;
	}

	const [row] = await db
		.insert(installedPlugins)
		.values({
			workspaceId,
			pluginSlug: slug,
			enabled: opts?.enabled !== false,
			webhookEndpointId,
			config: webhookUrl ? { webhook_url: webhookUrl } : {},
		})
		.returning();

	if (!row) throw new Error("Failed to install plugin.");
	return row;
}

export async function uninstallWorkspacePlugin(
	workspaceId: string,
	slug: string,
): Promise<void> {
	const row = await db.query.installedPlugins.findFirst({
		where: and(
			eq(installedPlugins.workspaceId, workspaceId),
			eq(installedPlugins.pluginSlug, slug),
		),
	});
	if (!row) throw notFound("Plugin is not installed.");

	await db
		.delete(installedPlugins)
		.where(eq(installedPlugins.id, row.id));
}
