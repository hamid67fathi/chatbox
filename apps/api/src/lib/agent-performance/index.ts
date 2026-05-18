import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { csatResponses, users, workspaceMembers } from "../../db/schema/index.js";

export interface AgentPerformanceRow {
	agent_id: string;
	agent_name: string | null;
	agent_email: string | null;
	conversations_total: number;
	conversations_resolved: number;
	resolution_rate: number | null;
	avg_first_response_sec: number | null;
	csat_average: number | null;
	csat_count: number;
}

export interface AgentPerformanceReport {
	agents: AgentPerformanceRow[];
	team: {
		conversations_total: number;
		conversations_resolved: number;
		resolution_rate: number | null;
		avg_first_response_sec: number | null;
		csat_average: number | null;
		csat_count: number;
	};
	refreshed_at: string | null;
}

export async function refreshAgentPerformanceView(): Promise<void> {
	await db.execute(
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY agent_performance_daily`,
	);
}

export async function getAgentPerformanceReport(
	workspaceId: string,
	from: Date,
	to: Date,
	opts?: { refreshedAt?: Date | null },
): Promise<AgentPerformanceReport> {
	const fromDay = from.toISOString().slice(0, 10);
	const toDay = to.toISOString().slice(0, 10);

	type ConvAggRow = {
		agent_id: string;
		conversations_total: number;
		conversations_resolved: number;
		avg_first_response_sec: string | null;
	};

	const convRows = (await db.execute(sql`
		SELECT
			agent_id,
			sum(conversations_total)::int AS conversations_total,
			sum(conversations_resolved)::int AS conversations_resolved,
			avg(avg_first_response_sec) FILTER (
				WHERE avg_first_response_sec IS NOT NULL
			) AS avg_first_response_sec
		FROM agent_performance_daily
		WHERE workspace_id = ${workspaceId}
			AND day >= ${fromDay}::date
			AND day <= ${toDay}::date
		GROUP BY agent_id
	`)) as ConvAggRow[];

	const csatRows = await db
		.select({
			agentId: csatResponses.assignedAgentId,
			avgScore: sql<string>`avg(${csatResponses.score})`,
			count: sql<number>`count(*)::int`,
		})
		.from(csatResponses)
		.where(
			and(
				eq(csatResponses.workspaceId, workspaceId),
				gte(csatResponses.createdAt, from),
				lte(csatResponses.createdAt, to),
			),
		)
		.groupBy(csatResponses.assignedAgentId)
		.having(isNotNull(csatResponses.assignedAgentId));

	const members = await db
		.select({
			userId: workspaceMembers.userId,
			email: users.email,
			fullName: users.fullName,
		})
		.from(workspaceMembers)
		.innerJoin(users, eq(workspaceMembers.userId, users.id))
		.where(eq(workspaceMembers.workspaceId, workspaceId));

	const memberMap = new Map(
		members.map((m) => [
			m.userId,
			{ email: m.email, fullName: m.fullName },
		]),
	);

	const csatByAgent = new Map<
		string,
		{ avg: number | null; count: number }
	>();
	for (const row of csatRows) {
		if (!row.agentId) continue;
		const count = Number(row.count);
		const avgRaw = row.avgScore != null ? Number(row.avgScore) : null;
		csatByAgent.set(row.agentId, {
			avg:
				avgRaw != null && count > 0
					? Math.round(avgRaw * 10) / 10
					: null,
			count,
		});
	}

	const agentIds = new Set<string>();
	for (const row of convRows) {
		if (row.agent_id) agentIds.add(row.agent_id);
	}
	for (const id of csatByAgent.keys()) agentIds.add(id);

	const convByAgent = new Map(
		convRows.map((r) => [
			r.agent_id,
			{
				conversations_total: Number(r.conversations_total),
				conversations_resolved: Number(r.conversations_resolved),
				avg_first_response_sec:
					r.avg_first_response_sec != null
						? Math.round(Number(r.avg_first_response_sec))
						: null,
			},
		]),
	);

	const agents: AgentPerformanceRow[] = [...agentIds].map((agentId) => {
		const conv = convByAgent.get(agentId) ?? {
			conversations_total: 0,
			conversations_resolved: 0,
			avg_first_response_sec: null,
		};
		const csat = csatByAgent.get(agentId) ?? { avg: null, count: 0 };
		const member = memberMap.get(agentId);
		const total = conv.conversations_total;
		const resolved = conv.conversations_resolved;
		return {
			agent_id: agentId,
			agent_name: member?.fullName ?? null,
			agent_email: member?.email ?? null,
			conversations_total: total,
			conversations_resolved: resolved,
			resolution_rate:
				total > 0
					? Math.round((resolved / total) * 1000) / 10
					: null,
			avg_first_response_sec: conv.avg_first_response_sec,
			csat_average: csat.avg,
			csat_count: csat.count,
		};
	});

	agents.sort((a, b) => b.conversations_total - a.conversations_total);

	let teamTotal = 0;
	let teamResolved = 0;
	let frSum = 0;
	let frCount = 0;
	let csatSum = 0;
	let csatCount = 0;

	for (const a of agents) {
		teamTotal += a.conversations_total;
		teamResolved += a.conversations_resolved;
		if (a.avg_first_response_sec != null) {
			frSum += a.avg_first_response_sec;
			frCount += 1;
		}
		if (a.csat_average != null && a.csat_count > 0) {
			csatSum += a.csat_average * a.csat_count;
			csatCount += a.csat_count;
		}
	}

	return {
		agents,
		team: {
			conversations_total: teamTotal,
			conversations_resolved: teamResolved,
			resolution_rate:
				teamTotal > 0
					? Math.round((teamResolved / teamTotal) * 1000) / 10
					: null,
			avg_first_response_sec:
				frCount > 0 ? Math.round(frSum / frCount) : null,
			csat_average:
				csatCount > 0
					? Math.round((csatSum / csatCount) * 10) / 10
					: null,
			csat_count: csatCount,
		},
		refreshed_at: opts?.refreshedAt?.toISOString() ?? null,
	};
}

export function agentPerformanceToCsv(
	rows: AgentPerformanceRow[],
): string {
	const header =
		"agent_id,agent_name,agent_email,conversations_total,conversations_resolved,resolution_rate,avg_first_response_sec,csat_average,csat_count";
	const lines = rows.map((r) =>
		[
			r.agent_id,
			escapeCsv(r.agent_name ?? ""),
			escapeCsv(r.agent_email ?? ""),
			r.conversations_total,
			r.conversations_resolved,
			r.resolution_rate ?? "",
			r.avg_first_response_sec ?? "",
			r.csat_average ?? "",
			r.csat_count,
		].join(","),
	);
	return [header, ...lines].join("\n");
}

function escapeCsv(value: string): string {
	if (/[",\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}
