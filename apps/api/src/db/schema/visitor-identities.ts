import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { workspaces } from "./workspaces.js";

export const visitorIdentities = pgTable(
	"visitor_identities",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		visitorId: text("visitor_id").notNull(),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		method: text("method").notNull(),
		identifiedAt: timestamp("identified_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		uniqueIndex("idx_visitor_identities_ws_visitor").on(
			t.workspaceId,
			t.visitorId,
		),
		index("idx_visitor_identities_contact").on(t.workspaceId, t.contactId),
	],
);
