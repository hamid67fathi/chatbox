import {
	index,
	jsonb,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { userRoleEnum, userStatusEnum } from "./enums.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const workspaceMembers = pgTable(
	"workspace_members",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: userRoleEnum("role").notNull().default("agent"),
		status: userStatusEnum("status").notNull().default("invited"),
		invitedBy: uuid("invited_by").references(() => users.id),
		joinedAt: timestamp("joined_at", { withTimezone: true }),
		notificationPreferences: jsonb("notification_preferences")
			.notNull()
			.default({
				push_enabled: true,
				new_conversation: true,
				new_message: true,
				email_enabled: true,
				email_new_conversation: true,
				email_assigned: true,
				email_mention: true,
			}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.workspaceId, t.userId] }),
		index("idx_members_user").on(t.userId),
	],
);
