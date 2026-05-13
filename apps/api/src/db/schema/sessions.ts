import {
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").notNull(),
		refreshToken: text("refresh_token").notNull().unique(),
		userAgent: text("user_agent"),
		ipAddress: text("ip_address"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_sessions_user").on(t.userId),
		index("idx_sessions_refresh").on(t.refreshToken),
	],
);
