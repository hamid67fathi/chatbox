import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const otpCodes = pgTable(
	"otp_codes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email"),
		phone: text("phone"),
		code: text("code").notNull(),
		used: boolean("used").notNull().default(false),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_otp_email").on(t.email),
		index("idx_otp_phone").on(t.phone),
	],
);
