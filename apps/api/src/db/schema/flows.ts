import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { conversations } from "./conversations.js";
import { workspaces } from "./workspaces.js";

export const flows = pgTable("flows", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	status: text("status").notNull().default("draft"),
	trigger: text("trigger").notNull().default("widget_start"),
	definition: jsonb("definition").notNull().default({}),
	publishedAt: timestamp("published_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const flowSessions = pgTable("flow_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	flowId: uuid("flow_id")
		.notNull()
		.references(() => flows.id, { onDelete: "cascade" }),
	conversationId: uuid("conversation_id")
		.notNull()
		.references(() => conversations.id, { onDelete: "cascade" }),
	contactId: uuid("contact_id")
		.notNull()
		.references(() => contacts.id, { onDelete: "cascade" }),
	currentNodeId: text("current_node_id"),
	status: text("status").notNull().default("active"),
	variables: jsonb("variables").notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
