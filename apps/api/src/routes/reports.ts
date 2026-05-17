import { and, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
	contacts,
	conversationTags,
	conversations,
	messages,
	users,
} from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { getWorkspaceRole } from "../lib/conversation-access.js";
import {
	conversationsToCsv,
	type ReportRow,
} from "../lib/conversation-report-csv.js";
import {
	buildConversationReportConditions,
	SORT_AT,
	type ReportQueryParams,
} from "../lib/conversation-report-filters.js";
import { validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

const MAX_PAGE = 100;
const MAX_EXPORT = 5000;

async function fetchReportRows(
	workspaceId: string,
	userId: string,
	query: ReportQueryParams,
	opts: { limit: number; offset: number },
): Promise<ReportRow[]> {
	const role = await getWorkspaceRole(workspaceId, userId);
	const conditions = buildConversationReportConditions(
		workspaceId,
		userId,
		role,
		query,
	);

	const rows = await db
		.select({
			id: conversations.id,
			createdAt: conversations.createdAt,
			lastMessageAt: conversations.lastMessageAt,
			closedAt: conversations.closedAt,
			status: conversations.status,
			channel: conversations.channel,
			subject: conversations.subject,
			csatScore: conversations.csatScore,
			firstResponseSec: conversations.firstResponseSec,
			metadata: conversations.metadata,
			contactFullName: contacts.fullName,
			contactEmail: contacts.email,
			contactPhone: contacts.phone,
			agentEmail: users.email,
			agentFullName: users.fullName,
		})
		.from(conversations)
		.leftJoin(contacts, eq(conversations.contactId, contacts.id))
		.leftJoin(users, eq(conversations.assignedAgentId, users.id))
		.where(and(...conditions))
		.orderBy(sql`${SORT_AT} DESC`)
		.limit(opts.limit)
		.offset(opts.offset);

	if (rows.length === 0) return [];

	const ids = rows.map((r) => r.id);

	const [counts, tagRows] = await Promise.all([
		db
			.select({
				conversationId: messages.conversationId,
				n: sql<number>`count(*)::int`,
			})
			.from(messages)
			.where(
				and(
					eq(messages.workspaceId, workspaceId),
					inArray(messages.conversationId, ids),
				),
			)
			.groupBy(messages.conversationId),
		db
			.select({
				conversationId: conversationTags.conversationId,
				tag: conversationTags.tag,
			})
			.from(conversationTags)
			.where(inArray(conversationTags.conversationId, ids)),
	]);

	const countMap = new Map(
		counts.map((c) => [c.conversationId, Number(c.n)]),
	);
	const tagsByConv = new Map<string, { tag: string }[]>();
	for (const t of tagRows) {
		const list = tagsByConv.get(t.conversationId) ?? [];
		list.push({ tag: t.tag });
		tagsByConv.set(t.conversationId, list);
	}

	return rows.map((r) => ({
		id: r.id,
		createdAt: r.createdAt,
		lastMessageAt: r.lastMessageAt,
		closedAt: r.closedAt,
		status: r.status,
		channel: r.channel,
		subject: r.subject,
		csatScore: r.csatScore,
		firstResponseSec: r.firstResponseSec,
		metadata: r.metadata,
		contact:
			r.contactFullName || r.contactEmail || r.contactPhone
				? {
						fullName: r.contactFullName,
						email: r.contactEmail,
						phone: r.contactPhone,
					}
				: null,
		assignedAgent:
			r.agentEmail || r.agentFullName
				? {
						email: r.agentEmail,
						fullName: r.agentFullName,
					}
				: null,
		tags: tagsByConv.get(r.id) ?? [],
		messageCount: countMap.get(r.id) ?? 0,
	}));
}

function mapRowForJson(r: ReportRow) {
	return {
		id: r.id,
		status: r.status,
		channel: r.channel,
		subject: r.subject,
		created_at: r.createdAt.toISOString(),
		last_message_at: r.lastMessageAt?.toISOString() ?? null,
		closed_at: r.closedAt?.toISOString() ?? null,
		csat_score: r.csatScore,
		first_response_sec: r.firstResponseSec,
		message_count: r.messageCount,
		archived:
			r.metadata && typeof r.metadata === "object"
				? Boolean((r.metadata as { archivedAt?: string }).archivedAt)
				: false,
		contact: r.contact
			? {
					full_name: r.contact.fullName,
					email: r.contact.email,
					phone: r.contact.phone,
				}
			: null,
		assigned_agent: r.assignedAgent
			? {
					email: r.assignedAgent.email,
					full_name: r.assignedAgent.fullName,
				}
			: null,
		tags: r.tags.map((t) => t.tag),
	};
}

async function countMatching(
	workspaceId: string,
	userId: string,
	query: ReportQueryParams,
): Promise<number> {
	const role = await getWorkspaceRole(workspaceId, userId);
	const conditions = buildConversationReportConditions(
		workspaceId,
		userId,
		role,
		query,
	);
	const [totalRow] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(conversations)
		.where(and(...conditions));
	return Number(totalRow?.n ?? 0);
}

export async function reportRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: ReportQueryParams & {
			limit?: string;
			offset?: string;
		};
	}>(
		"/v1/reports/conversations",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const limit = Math.min(
				Math.max(Number(request.query.limit) || 50, 1),
				MAX_PAGE,
			);
			const offset = Math.max(Number(request.query.offset) || 0, 0);

			const [total, rows] = await Promise.all([
				countMatching(wsId, user.id, request.query),
				fetchReportRows(wsId, user.id, request.query, { limit, offset }),
			]);

			return {
				data: rows.map(mapRowForJson),
				page: {
					limit,
					offset,
					total,
					has_more: offset + rows.length < total,
				},
			};
		},
	);

	app.get<{
		Querystring: ReportQueryParams & { format?: string };
	}>(
		"/v1/reports/conversations/export",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request, reply) => {
			const format = request.query.format ?? "csv";
			if (format !== "csv") {
				throw validationError('Only format=csv is supported.', "format");
			}

			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;

			if (!request.query.from || !request.query.to) {
				throw validationError(
					"from and to date parameters are required for export.",
					"from",
				);
			}

			const [total, rows] = await Promise.all([
				countMatching(wsId, user.id, request.query),
				fetchReportRows(wsId, user.id, request.query, {
					limit: MAX_EXPORT,
					offset: 0,
				}),
			]);

			const truncated = total > MAX_EXPORT;
			const csv = conversationsToCsv(rows);
			const fromSlug = request.query.from.slice(0, 10);
			const toSlug = request.query.to.slice(0, 10);

			return reply
				.header("Content-Type", "text/csv; charset=utf-8")
				.header(
					"Content-Disposition",
					`attachment; filename="chatbox-conversations-${fromSlug}_${toSlug}.csv"`,
				)
				.header("X-Export-Truncated", truncated ? "true" : "false")
				.header("X-Export-Total", String(total))
				.send(csv);
		},
	);
}
