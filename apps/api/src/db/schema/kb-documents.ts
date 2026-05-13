import {
	bigint,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { kbDocStatusEnum } from "./enums.js";
import { knowledgeBases } from "./knowledge-bases.js";
import { workspaces } from "./workspaces.js";

export const kbDocuments = pgTable(
	"kb_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		kbId: uuid("kb_id")
			.notNull()
			.references(() => knowledgeBases.id, { onDelete: "cascade" }),
		sourceType: text("source_type").notNull(),
		sourceUrl: text("source_url"),
		filePath: text("file_path"),
		title: text("title"),
		status: kbDocStatusEnum("status").notNull().default("uploaded"),
		sizeBytes: bigint("size_bytes", { mode: "number" }),
		pageCount: integer("page_count"),
		chunkCount: integer("chunk_count").notNull().default(0),
		lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("idx_kbdoc_kb").on(t.kbId, t.status)],
);
