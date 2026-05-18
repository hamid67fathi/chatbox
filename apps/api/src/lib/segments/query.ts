import type { SegmentFilters } from "@chatbox/shared/segments";
import { and, eq, exists, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, conversations } from "../../db/schema/index.js";

function parseDate(iso: string | undefined): Date | null {
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

export function buildSegmentWhere(
	workspaceId: string,
	filters: SegmentFilters,
) {
	const parts = [eq(contacts.workspaceId, workspaceId)];

	if (filters.tags?.length) {
		const tags = filters.tags;
		if (filters.tag_mode === "all") {
			for (const tag of tags) {
				parts.push(sql`${tag} = ANY(${contacts.tags})`);
			}
		} else {
			parts.push(
				sql`${contacts.tags} && ARRAY[${sql.join(
					tags.map((t) => sql`${t}`),
					sql`, `,
				)}]::text[]`,
			);
		}
	}

	const after = parseDate(filters.last_seen_after);
	if (after) parts.push(gte(contacts.lastSeenAt, after));

	const before = parseDate(filters.last_seen_before);
	if (before) parts.push(lte(contacts.lastSeenAt, before));

	if (filters.channels?.length) {
		const channels = filters.channels;
		parts.push(
			exists(
				db
					.select({ id: conversations.id })
					.from(conversations)
					.where(
						and(
							eq(conversations.contactId, contacts.id),
							eq(conversations.workspaceId, workspaceId),
							inArray(conversations.channel, channels),
						),
					),
			),
		);
	}

	if (filters.min_conversations != null || filters.max_conversations != null) {
		const countExpr = sql`(
			SELECT COUNT(*)::int FROM ${conversations}
			WHERE ${conversations.contactId} = ${contacts.id}
			AND ${conversations.workspaceId} = ${workspaceId}
		)`;
		if (filters.min_conversations != null) {
			parts.push(sql`${countExpr} >= ${filters.min_conversations}`);
		}
		if (filters.max_conversations != null) {
			parts.push(sql`${countExpr} <= ${filters.max_conversations}`);
		}
	}

	return and(...parts);
}

export async function countSegmentMembers(
	workspaceId: string,
	filters: SegmentFilters,
): Promise<number> {
	const where = buildSegmentWhere(workspaceId, filters);
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(contacts)
		.where(where);
	return row?.count ?? 0;
}

export async function previewSegmentMembers(
	workspaceId: string,
	filters: SegmentFilters,
	limit = 10,
) {
	const where = buildSegmentWhere(workspaceId, filters);
	return db
		.select({
			id: contacts.id,
			fullName: contacts.fullName,
			email: contacts.email,
			lastSeenAt: contacts.lastSeenAt,
			tags: contacts.tags,
		})
		.from(contacts)
		.where(where)
		.orderBy(sql`${contacts.lastSeenAt} DESC NULLS LAST`)
		.limit(limit);
}

export async function isContactInSegment(
	workspaceId: string,
	contactId: string,
	filters: SegmentFilters,
): Promise<boolean> {
	const where = and(
		buildSegmentWhere(workspaceId, filters),
		eq(contacts.id, contactId),
	);
	const [row] = await db
		.select({ id: contacts.id })
		.from(contacts)
		.where(where)
		.limit(1);
	return Boolean(row);
}

export async function getSegmentFiltersById(
	workspaceId: string,
	segmentId: string,
): Promise<SegmentFilters | null> {
	const { contactSegments } = await import("../../db/schema/index.js");
	const { parseSegmentFilters } = await import("@chatbox/shared/segments");
	const row = await db.query.contactSegments.findFirst({
		where: and(
			eq(contactSegments.workspaceId, workspaceId),
			eq(contactSegments.id, segmentId),
		),
		columns: { filters: true },
	});
	if (!row) return null;
	return parseSegmentFilters(row.filters);
}
