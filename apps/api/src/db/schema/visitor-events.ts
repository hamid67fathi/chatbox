import {
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { workspaces } from "./workspaces.js";

export const visitorEvents = pgTable(
	"visitor_events",
	{
		id: uuid("id").notNull().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		visitorId: text("visitor_id").notNull(),
		contactId: uuid("contact_id").references(() => contacts.id, {
			onDelete: "set null",
		}),
		eventType: text("event_type").notNull(),
		url: text("url"),
		referrer: text("referrer"),
		payload: jsonb("payload").notNull().default({}),
		ip: text("ip"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.id, t.createdAt] }),
		index("idx_visitor_events_ws_visitor_created").on(
			t.workspaceId,
			t.visitorId,
			t.createdAt,
		),
		index("idx_visitor_events_ws_contact_created").on(
			t.workspaceId,
			t.contactId,
			t.createdAt,
		),
	],
);
