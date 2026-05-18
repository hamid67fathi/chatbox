import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { conversations } from "../../db/schema/index.js";
import { computeSlaStatus } from "./compute.js";
import { getSlaPolicyForWorkspace } from "./policy.js";

export interface SlaViolationRow {
	conversation_id: string;
	created_at: string;
	status: string;
	channel: string;
	first_response_breached: boolean;
	resolution_breached: boolean;
	first_response_at: string | null;
	resolved_at: string | null;
}

export async function listSlaViolations(
	workspaceId: string,
	from: Date,
	to: Date,
	limit = 100,
): Promise<SlaViolationRow[]> {
	const policy = await getSlaPolicyForWorkspace(workspaceId);
	if (!policy.enabled) return [];

	const rows = await db.query.conversations.findMany({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			gte(conversations.createdAt, from),
			lte(conversations.createdAt, to),
		),
		orderBy: [desc(conversations.createdAt)],
		limit: Math.min(limit, 500),
		columns: {
			id: true,
			createdAt: true,
			status: true,
			channel: true,
			firstResponseAt: true,
			firstResponseSec: true,
			resolvedAt: true,
			closedAt: true,
		},
	});

	const violations: SlaViolationRow[] = [];
	for (const row of rows) {
		const sla = computeSlaStatus(row, policy);
		const frBreached = sla.first_response === "breached";
		const resBreached = sla.resolution === "breached";
		if (!frBreached && !resBreached) continue;

		violations.push({
			conversation_id: row.id,
			created_at: row.createdAt.toISOString(),
			status: row.status,
			channel: row.channel,
			first_response_breached: frBreached,
			resolution_breached: resBreached,
			first_response_at: row.firstResponseAt?.toISOString() ?? null,
			resolved_at:
				row.resolvedAt?.toISOString() ?? row.closedAt?.toISOString() ?? null,
		});
	}

	return violations;
}
