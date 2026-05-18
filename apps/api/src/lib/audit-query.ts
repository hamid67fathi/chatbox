import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs, users } from "../db/schema/index.js";

const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_EXPORT = 10_000;

export function clampAuditDateRange(from?: string, to?: string) {
	const now = Date.now();
	const minFrom = new Date(now - RETENTION_MS);
	const toDate = to ? new Date(to) : new Date();
	const fromDate = from ? new Date(from) : new Date(now - 30 * 24 * 60 * 60 * 1000);
	const clampedFrom = fromDate < minFrom ? minFrom : fromDate;
	if (Number.isNaN(clampedFrom.getTime()) || Number.isNaN(toDate.getTime())) {
		return { from: minFrom, to: new Date() };
	}
	return {
		from: clampedFrom,
		to: toDate > new Date() ? new Date() : toDate,
	};
}

export async function queryAuditLogs(opts: {
	workspaceId: string;
	from: Date;
	to: Date;
	action?: string;
	actorUserId?: string;
	limit: number;
	offset: number;
}) {
	const conditions: SQL[] = [
		eq(auditLogs.workspaceId, opts.workspaceId),
		gte(auditLogs.createdAt, opts.from),
		lte(auditLogs.createdAt, opts.to),
	];
	if (opts.action) conditions.push(eq(auditLogs.action, opts.action));
	if (opts.actorUserId) {
		conditions.push(eq(auditLogs.actorUserId, opts.actorUserId));
	}

	const where = and(...conditions);

	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(auditLogs)
		.where(where);

	const rows = await db
		.select({
			id: auditLogs.id,
			workspaceId: auditLogs.workspaceId,
			actorUserId: auditLogs.actorUserId,
			actorEmail: users.email,
			actorName: users.fullName,
			action: auditLogs.action,
			targetType: auditLogs.targetType,
			targetId: auditLogs.targetId,
			diff: auditLogs.diff,
			ipAddress: auditLogs.ipAddress,
			userAgent: auditLogs.userAgent,
			createdAt: auditLogs.createdAt,
		})
		.from(auditLogs)
		.leftJoin(users, eq(auditLogs.actorUserId, users.id))
		.where(where)
		.orderBy(desc(auditLogs.createdAt))
		.limit(opts.limit)
		.offset(opts.offset);

	return { total: countRow?.count ?? 0, rows };
}

export async function fetchAuditLogsForExport(
	workspaceId: string,
	from: Date,
	to: Date,
	action?: string,
) {
	const { rows } = await queryAuditLogs({
		workspaceId,
		from,
		to,
		action,
		limit: MAX_EXPORT,
		offset: 0,
	});
	return rows;
}

export function auditLogsToCsv(
	rows: Awaited<ReturnType<typeof queryAuditLogs>>["rows"],
): string {
	const header = [
		"id",
		"created_at",
		"action",
		"actor_email",
		"actor_name",
		"target_type",
		"target_id",
		"ip_address",
		"diff",
	].join(",");
	const lines = rows.map((r) =>
		[
			r.id,
			r.createdAt.toISOString(),
			csvEscape(r.action),
			csvEscape(r.actorEmail ?? ""),
			csvEscape(r.actorName ?? ""),
			csvEscape(r.targetType ?? ""),
			csvEscape(r.targetId ?? ""),
			csvEscape(r.ipAddress ?? ""),
			csvEscape(r.diff ? JSON.stringify(r.diff) : ""),
		].join(","),
	);
	return `\uFEFF${header}\n${lines.join("\n")}\n`;
}

function csvEscape(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export { MAX_EXPORT as AUDIT_MAX_EXPORT };
