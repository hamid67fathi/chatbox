import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email").unique(),
		phone: text("phone").unique(),
		passwordHash: text("password_hash"),
		fullName: text("full_name"),
		avatarUrl: text("avatar_url"),
		locale: text("locale").notNull().default("fa-IR"),
		totpSecret: text("totp_secret"),
		totpRecoveryHashes: text("totp_recovery_hashes"),
		emailVerified: boolean("email_verified").notNull().default(false),
		phoneVerified: boolean("phone_verified").notNull().default(false),
		oauthProvider: text("oauth_provider"),
		oauthProviderId: text("oauth_provider_id"),
		lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(t) => [
		index("idx_users_email_active").on(t.email).where(sql`deleted_at IS NULL`),
		index("idx_users_phone_active").on(t.phone).where(sql`deleted_at IS NULL`),
	],
);
