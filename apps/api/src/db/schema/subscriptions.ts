import { sql } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
	"trialing",
	"active",
	"past_due",
	"cancelled",
	"expired",
]);

export const subscriptions = pgTable(
	"subscriptions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id").notNull(),
		plan: text("plan").notNull().default("free"),
		status: subscriptionStatusEnum("status").notNull().default("trialing"),
		periodStart: timestamp("period_start", { withTimezone: true }),
		periodEnd: timestamp("period_end", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_subscriptions_workspace").on(t.workspaceId),
		index("idx_subscriptions_status").on(t.status),
	],
);

export const payments = pgTable(
	"payments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id").notNull(),
		subscriptionId: uuid("subscription_id"),
		amountRial: integer("amount_rial").notNull(),
		currency: text("currency").notNull().default("IRR"),
		provider: text("provider").notNull().default("zarinpal"),
		providerRefId: text("provider_ref_id"),
		authority: text("authority"),
		status: text("status").notNull().default("pending"),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_payments_workspace").on(t.workspaceId),
		index("idx_payments_authority").on(t.authority),
		index("idx_payments_status").on(t.status).where(sql`status = 'pending'`),
	],
);
