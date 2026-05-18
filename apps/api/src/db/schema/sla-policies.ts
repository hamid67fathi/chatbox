import {
	boolean,
	integer,
	pgTable,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const slaPolicies = pgTable("sla_policies", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.unique()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	enabled: boolean("enabled").notNull().default(true),
	firstResponseMinutes: integer("first_response_minutes").notNull().default(15),
	resolutionMinutes: integer("resolution_minutes").notNull().default(1440),
	warnAtPercent: integer("warn_at_percent").notNull().default(80),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
