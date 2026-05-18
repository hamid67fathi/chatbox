import {
	index,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { conversations } from "./conversations.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const csatResponses = pgTable(
	"csat_responses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		conversationId: uuid("conversation_id")
			.notNull()
			.unique()
			.references(() => conversations.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		assignedAgentId: uuid("assigned_agent_id").references(() => users.id, {
			onDelete: "set null",
		}),
		score: smallint("score").notNull(),
		comment: text("comment"),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_csat_workspace_created").on(t.workspaceId, t.createdAt),
		index("idx_csat_agent").on(t.workspaceId, t.assignedAgentId),
	],
);
