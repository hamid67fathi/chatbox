import { sql } from "drizzle-orm";
import { conversations } from "../db/schema/index.js";

export type ConversationMetadata = Record<string, unknown> & {
	archivedAt?: string;
	archivedBy?: string;
};

export function isArchived(metadata: unknown): boolean {
	if (!metadata || typeof metadata !== "object") return false;
	const m = metadata as ConversationMetadata;
	return typeof m.archivedAt === "string" && m.archivedAt.length > 0;
}

export function archiveMetadataPatch(
	existing: unknown,
	userId: string,
): ConversationMetadata {
	const base =
		existing && typeof existing === "object"
			? { ...(existing as ConversationMetadata) }
			: {};
	return {
		...base,
		archivedAt: new Date().toISOString(),
		archivedBy: userId,
	};
}

export function unarchiveMetadataPatch(existing: unknown): ConversationMetadata {
	const base =
		existing && typeof existing === "object"
			? { ...(existing as ConversationMetadata) }
			: {};
	delete base.archivedAt;
	delete base.archivedBy;
	return base;
}

/** SQL: conversation is archived when metadata has archivedAt. */
export const archivedCondition = sql`(${conversations.metadata}->>'archivedAt') IS NOT NULL AND (${conversations.metadata}->>'archivedAt') <> ''`;

export const notArchivedCondition = sql`((${conversations.metadata}->>'archivedAt') IS NULL OR (${conversations.metadata}->>'archivedAt') = '')`;
