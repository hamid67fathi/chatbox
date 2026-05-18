import type { FastifyInstance } from "fastify";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { auditLogFromRequest } from "../lib/audit-log.js";
import {
	auditLogsToCsv,
	clampAuditDateRange,
	fetchAuditLogsForExport,
	queryAuditLogs,
} from "../lib/audit-query.js";
import { validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function auditLogRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: {
			from?: string;
			to?: string;
			action?: string;
			actor_id?: string;
			limit?: string;
			offset?: string;
		};
	}>(
		"/v1/audit-logs",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const { from, to } = clampAuditDateRange(
				request.query.from,
				request.query.to,
			);
			const limit = Math.min(Number(request.query.limit) || 50, 200);
			const offset = Math.max(Number(request.query.offset) || 0, 0);

			const { total, rows } = await queryAuditLogs({
				workspaceId: wsId,
				from,
				to,
				action: request.query.action?.trim() || undefined,
				actorUserId: request.query.actor_id?.trim() || undefined,
				limit,
				offset,
			});

			return {
				data: rows.map((r) => ({
					id: r.id,
					workspace_id: r.workspaceId,
					actor_user_id: r.actorUserId,
					actor_email: r.actorEmail,
					actor_name: r.actorName,
					action: r.action,
					target_type: r.targetType,
					target_id: r.targetId,
					diff: r.diff,
					ip_address: r.ipAddress,
					user_agent: r.userAgent,
					created_at: r.createdAt.toISOString(),
				})),
				meta: { total, limit, offset, from: from.toISOString(), to: to.toISOString() },
			};
		},
	);

	app.get<{
		Querystring: {
			from?: string;
			to?: string;
			action?: string;
			format?: string;
		};
	}>(
		"/v1/audit-logs/export",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			if ((request.query.format ?? "csv") !== "csv") {
				throw validationError('Only format=csv is supported.', "format");
			}
			const wsId = getWorkspaceId(request);
			const { from, to } = clampAuditDateRange(
				request.query.from,
				request.query.to,
			);
			const rows = await fetchAuditLogsForExport(
				wsId,
				from,
				to,
				request.query.action?.trim() || undefined,
			);
			const csv = auditLogsToCsv(rows);
			const fromSlug = from.toISOString().slice(0, 10);
			const toSlug = to.toISOString().slice(0, 10);
			const user = (request as AuthenticatedRequest).user;
			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: "audit.export",
				targetType: "audit_logs",
				diff: { from: fromSlug, to: toSlug, rows: rows.length },
			});
			return reply
				.header("Content-Type", "text/csv; charset=utf-8")
				.header(
					"Content-Disposition",
					`attachment; filename="chatbox-audit-${fromSlug}_${toSlug}.csv"`,
				)
				.send(csv);
		},
	);
}
