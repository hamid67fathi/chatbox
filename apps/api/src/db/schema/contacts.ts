import { sql } from "drizzle-orm";
import {
	bigint,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const contacts = pgTable(
	"contacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		externalId: text("external_id"),
		fullName: text("full_name"),
		email: text("email"),
		phone: text("phone"),
		telegramId: bigint("telegram_id", { mode: "number" }),
		avatarUrl: text("avatar_url"),
		metadata: jsonb("metadata").notNull().default({}),
		tags: text("tags").array().notNull().default([]),
		firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		uniqueIndex("idx_contacts_ws_email")
			.on(t.workspaceId, t.email)
			.where(sql`email IS NOT NULL`),
		uniqueIndex("idx_contacts_ws_phone")
			.on(t.workspaceId, t.phone)
			.where(sql`phone IS NOT NULL`),
		uniqueIndex("idx_contacts_ws_tg")
			.on(t.workspaceId, t.telegramId)
			.where(sql`telegram_id IS NOT NULL`),
		index("idx_contacts_metadata").using("gin", t.metadata),
	],
);
