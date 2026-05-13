import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const knowledgeBases = pgTable(
	"knowledge_bases",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		embeddingModel: text("embedding_model")
			.notNull()
			.default("text-embedding-3-small"),
		settings: jsonb("settings").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("idx_kb_workspace").on(t.workspaceId)],
);
