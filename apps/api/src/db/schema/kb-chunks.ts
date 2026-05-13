import {
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { kbDocuments } from "./kb-documents.js";
import { workspaces } from "./workspaces.js";

const vector1536 = customType<{ data: number[]; driverParam: string }>({
	dataType() {
		return "vector(1536)";
	},
	toDriver(value: number[]) {
		return `[${value.join(",")}]`;
	},
	fromDriver(value: unknown) {
		const str = String(value);
		return str
			.replace(/[\[\]]/g, "")
			.split(",")
			.map(Number);
	},
});

export const kbChunks = pgTable(
	"kb_chunks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		documentId: uuid("document_id")
			.notNull()
			.references(() => kbDocuments.id, { onDelete: "cascade" }),
		chunkIndex: integer("chunk_index").notNull(),
		content: text("content").notNull(),
		contentTokens: integer("content_tokens"),
		embedding: vector1536("embedding"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("idx_chunks_doc").on(t.documentId, t.chunkIndex),
		index("idx_chunks_ws").on(t.workspaceId),
	],
);
