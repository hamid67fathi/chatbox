import { sql } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { workspacePlanEnum } from "./enums.js";

export const workspaces = pgTable(
	"workspaces",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug").notNull().unique(),
		name: text("name").notNull(),
		ownerUserId: uuid("owner_user_id").notNull(),
		plan: workspacePlanEnum("plan").notNull().default("free"),
		locale: text("locale").notNull().default("fa-IR"),
		timezone: text("timezone").notNull().default("Asia/Tehran"),
		settings: jsonb("settings").notNull().default({}),
		aiPersona: jsonb("ai_persona").notNull().default({}),
		aiCredits: integer("ai_credits").notNull().default(0),
		trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(t) => [
		index("idx_workspaces_owner")
			.on(t.ownerUserId)
			.where(sql`deleted_at IS NULL`),
		index("idx_workspaces_plan").on(t.plan).where(sql`deleted_at IS NULL`),
	],
);
