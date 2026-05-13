import {
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const cannedResponses = pgTable(
	"canned_responses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		shortcut: text("shortcut").notNull(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		variables: jsonb("variables"),
		createdBy: uuid("created_by").references(() => users.id),
		usageCount: integer("usage_count").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [unique("uq_canned_ws_shortcut").on(t.workspaceId, t.shortcut)],
);
