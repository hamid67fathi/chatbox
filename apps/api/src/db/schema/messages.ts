import {
	index,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { conversations } from "./conversations.js";
import {
	messageSenderTypeEnum,
	messageStatusEnum,
	messageTypeEnum,
} from "./enums.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const messages = pgTable(
	"messages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id, { onDelete: "cascade" }),
		senderType: messageSenderTypeEnum("sender_type").notNull(),
		senderUserId: uuid("sender_user_id").references(() => users.id),
		senderContactId: uuid("sender_contact_id").references(() => contacts.id),
		type: messageTypeEnum("type").notNull().default("text"),
		body: text("body"),
		attachments: jsonb("attachments"),
		replyToId: uuid("reply_to_id"),
		reactions: jsonb("reactions"),
		status: messageStatusEnum("status").notNull().default("sent"),
		aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),
		aiModel: text("ai_model"),
		aiCostUsd: numeric("ai_cost_usd", { precision: 10, scale: 6 }),
		editedAt: timestamp("edited_at", { withTimezone: true }),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),
		readAt: timestamp("read_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_msg_conv").on(t.conversationId, t.createdAt),
		index("idx_msg_ws_created").on(t.workspaceId, t.createdAt),
	],
);
