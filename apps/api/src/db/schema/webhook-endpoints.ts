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
import { workspaces } from "./workspaces.js";

export const webhookEndpoints = pgTable(
	"webhook_endpoints",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		url: text("url").notNull(),
		secret: text("secret").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		events: text("events").array().notNull().default([]),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_webhook_endpoints_workspace").on(t.workspaceId, t.enabled),
	],
);

export const webhookDeliveries = pgTable(
	"webhook_deliveries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		endpointId: uuid("endpoint_id")
			.notNull()
			.references(() => webhookEndpoints.id, { onDelete: "cascade" }),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		event: text("event").notNull(),
		payload: jsonb("payload").notNull(),
		status: text("status").notNull().default("pending"),
		httpStatus: integer("http_status"),
		responseBody: text("response_body"),
		error: text("error"),
		attempts: integer("attempts").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),
	},
	(t) => [
		index("idx_webhook_deliveries_endpoint").on(t.endpointId, t.createdAt),
	],
);
