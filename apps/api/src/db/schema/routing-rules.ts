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

export const routingRules = pgTable(
	"routing_rules",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		priority: integer("priority").notNull().default(100),
		conditions: jsonb("conditions").notNull().default({}),
		action: jsonb("action").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_routing_rules_workspace").on(
			t.workspaceId,
			t.enabled,
			t.priority,
		),
	],
);
