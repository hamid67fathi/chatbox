import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { webhookEndpoints } from "./webhook-endpoints.js";
import { workspaces } from "./workspaces.js";

export const pluginCatalog = pgTable("plugin_catalog", {
	slug: text("slug").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	category: text("category").notNull(),
	icon: text("icon").notNull().default("🔌"),
	integrationType: text("integration_type").notNull().default("webhook"),
	setupPath: text("setup_path"),
	docsUrl: text("docs_url"),
	defaultEvents: text("default_events").array().notNull().default([]),
	sortOrder: integer("sort_order").notNull().default(0),
});

export const installedPlugins = pgTable(
	"installed_plugins",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		pluginSlug: text("plugin_slug")
			.notNull()
			.references(() => pluginCatalog.slug, { onDelete: "cascade" }),
		enabled: boolean("enabled").notNull().default(true),
		config: jsonb("config").notNull().default({}),
		webhookEndpointId: uuid("webhook_endpoint_id").references(
			() => webhookEndpoints.id,
			{ onDelete: "set null" },
		),
		installedAt: timestamp("installed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_installed_plugins_workspace").on(t.workspaceId),
		index("idx_installed_plugins_workspace_slug").on(
			t.workspaceId,
			t.pluginSlug,
		),
	],
);
