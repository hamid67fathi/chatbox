import {
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { workspaces } from "./workspaces.js";

export const contactAttributeDefinitions = pgTable(
	"contact_attribute_definitions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		label: text("label").notNull(),
		type: text("type").notNull(),
		options: jsonb("options").notNull().default([]),
		required: boolean("required").notNull().default(false),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [uniqueIndex("idx_contact_attr_def_ws_key").on(t.workspaceId, t.key)],
);

export const contactAttributeValues = pgTable(
	"contact_attribute_values",
	{
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		definitionId: uuid("definition_id")
			.notNull()
			.references(() => contactAttributeDefinitions.id, { onDelete: "cascade" }),
		value: text("value"),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.contactId, t.definitionId] })],
);
