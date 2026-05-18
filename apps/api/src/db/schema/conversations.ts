import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts.js";
import { conversationChannelEnum, conversationStatusEnum } from "./enums.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const conversations = pgTable(
	"conversations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		channel: conversationChannelEnum("channel").notNull(),
		status: conversationStatusEnum("status").notNull().default("open"),
		assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
		aiHandled: boolean("ai_handled").notNull().default(false),
		priority: smallint("priority").notNull().default(0),
		sentimentScore: numeric("sentiment_score", {
			precision: 3,
			scale: 2,
		}),
		csatScore: smallint("csat_score"),
		subject: text("subject"),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
		lastAgentReplyAt: timestamp("last_agent_reply_at", {
			withTimezone: true,
		}),
		firstResponseSec: integer("first_response_sec"),
		firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_conv_ws_status").on(t.workspaceId, t.status, t.lastMessageAt),
		index("idx_conv_assigned")
			.on(t.assignedAgentId, t.status)
			.where(sql`assigned_agent_id IS NOT NULL`),
		index("idx_conv_contact").on(t.contactId, t.createdAt),
		index("idx_conv_ws_channel").on(t.workspaceId, t.channel),
	],
);

export const conversationTags = pgTable(
	"conversation_tags",
	{
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id, { onDelete: "cascade" }),
		tag: text("tag").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.tag] }),
		index("idx_conv_tags_tag").on(t.tag),
	],
);

export const conversationNotes = pgTable("conversation_notes", {
	id: uuid("id").primaryKey().defaultRandom(),
	conversationId: uuid("conversation_id")
		.notNull()
		.references(() => conversations.id, { onDelete: "cascade" }),
	authorId: uuid("author_id")
		.notNull()
		.references(() => users.id),
	body: text("body").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
