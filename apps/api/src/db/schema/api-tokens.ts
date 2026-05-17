import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const apiTokens = pgTable(
	"api_tokens",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		createdBy: uuid("created_by")
			.notNull()
			.references(() => users.id),
		name: text("name").notNull(),
		tokenPrefix: text("token_prefix").notNull(),
		tokenHash: text("token_hash").notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_api_tokens_workspace").on(t.workspaceId),
		index("idx_api_tokens_hash").on(t.tokenHash),
	],
);
