import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { messages } from "./messages.js";
import { workspaces } from "./workspaces.js";

export const aiInteractions = pgTable(
	"ai_interactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		conversationId: uuid("conversation_id").references(() => conversations.id, {
			onDelete: "cascade",
		}),
		messageId: uuid("message_id").references(() => messages.id, {
			onDelete: "set null",
		}),
		purpose: text("purpose").notNull(),
		language: text("language"),
		model: text("model").notNull(),
		prompt: text("prompt"),
		response: text("response"),
		retrievedChunks: jsonb("retrieved_chunks"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
		latencyMs: integer("latency_ms"),
		confidence: numeric("confidence", { precision: 3, scale: 2 }),
		escalated: boolean("escalated").notNull().default(false),
		feedback: smallint("feedback"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_ai_ws_created").on(t.workspaceId, t.createdAt),
		index("idx_ai_purpose").on(t.purpose, t.createdAt),
	],
);
