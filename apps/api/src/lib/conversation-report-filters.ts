import {
	and,
	eq,
	exists,
	ilike,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import { db } from "../db/index.js";
import {
	contacts,
	conversationTags,
	conversations,
	messages,
} from "../db/schema/index.js";
import {
	agentInboxVisibilityCondition,
	isSupervisorRole,
	type WorkspaceRole,
} from "./conversation-access.js";
import { archivedCondition, notArchivedCondition } from "./conversation-archive.js";
import { validationError } from "./errors.js";

export interface ReportQueryParams {
	from?: string;
	to?: string;
	status?: string;
	channel?: string;
	assigned_to?: string;
	archived?: string;
	tag?: string;
	q?: string;
}

export const SORT_AT = sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`;

export function escapeIlikePattern(raw: string): string {
	return raw.replace(/[%_\\]/g, "\\$&");
}

function parseIsoDate(value: string, field: string): Date {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) {
		throw validationError(`Invalid date for ${field}.`, field);
	}
	return d;
}

export function buildConversationReportConditions(
	workspaceId: string,
	userId: string,
	role: WorkspaceRole | null,
	query: ReportQueryParams,
): SQL[] {
	const conditions: SQL[] = [eq(conversations.workspaceId, workspaceId)];

	if (role && !isSupervisorRole(role)) {
		conditions.push(agentInboxVisibilityCondition(userId));
	}

	if (query.from) {
		const from = parseIsoDate(query.from, "from").toISOString();
		conditions.push(sql`${SORT_AT} >= ${from}::timestamptz`);
	}
	if (query.to) {
		const to = parseIsoDate(query.to, "to").toISOString();
		conditions.push(sql`${SORT_AT} <= ${to}::timestamptz`);
	}

	const archivedFilter = query.archived ?? "all";
	if (archivedFilter === "true") {
		conditions.push(archivedCondition);
	} else if (archivedFilter === "false") {
		conditions.push(notArchivedCondition);
	}

	if (query.status) {
		conditions.push(eq(conversations.status, query.status as "open"));
	}
	if (query.channel) {
		conditions.push(eq(conversations.channel, query.channel as "widget"));
	}
	if (query.assigned_to) {
		conditions.push(eq(conversations.assignedAgentId, query.assigned_to));
	}

	if (query.tag?.trim()) {
		const tag = query.tag.trim();
		conditions.push(
			exists(
				db
					.select({ x: sql`1` })
					.from(conversationTags)
					.where(
						and(
							eq(conversationTags.conversationId, conversations.id),
							eq(conversationTags.tag, tag),
						),
					),
			),
		);
	}

	const q = query.q?.trim();
	if (q) {
		const pattern = `%${escapeIlikePattern(q)}%`;
		conditions.push(
			or(
				ilike(conversations.subject, pattern),
				exists(
					db
						.select({ x: sql`1` })
						.from(contacts)
						.where(
							and(
								eq(contacts.id, conversations.contactId),
								or(
									ilike(contacts.fullName, pattern),
									ilike(contacts.email, pattern),
									ilike(contacts.phone, pattern),
								),
							),
						),
				),
				exists(
					db
						.select({ x: sql`1` })
						.from(messages)
						.where(
							and(
								eq(messages.conversationId, conversations.id),
								eq(messages.workspaceId, workspaceId),
								ilike(messages.body, pattern),
							),
						),
				),
			)!,
		);
	}

	return conditions;
}
