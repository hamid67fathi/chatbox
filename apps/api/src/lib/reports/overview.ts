import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
	conversationTags,
	conversations,
} from "../../db/schema/index.js";

export interface ReportsOverview {
	conversations_over_time: Array<{
		day: string;
		created: number;
		resolved: number;
	}>;
	peak_hours: Array<{
		dow: number;
		hour: number;
		count: number;
	}>;
	channels: Array<{
		channel: string;
		count: number;
	}>;
	top_tags: Array<{
		tag: string;
		count: number;
	}>;
	funnel: {
		started: number;
		agent_replied: number;
		resolved: number;
		closed: number;
	};
}

const DOW_LABELS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function peakHourLabel(dow: number, hour: number): string {
	const day = DOW_LABELS[dow] ?? String(dow);
	return `${day} ${hour}:00`;
}

export async function getReportsOverview(
	workspaceId: string,
	from: Date,
	to: Date,
): Promise<ReportsOverview> {
	const baseWhere = and(
		eq(conversations.workspaceId, workspaceId),
		gte(conversations.createdAt, from),
		lte(conversations.createdAt, to),
	);

	const [overTimeRows, peakRows, channelRows, tagRows, funnelRow] =
		await Promise.all([
			db
				.select({
					day: sql<string>`(date_trunc('day', ${conversations.createdAt} AT TIME ZONE 'UTC'))::date::text`,
					created: sql<number>`count(*)::int`,
					resolved: sql<number>`count(*) filter (
						where ${conversations.status} in ('resolved', 'closed')
					)::int`,
				})
				.from(conversations)
				.where(baseWhere)
				.groupBy(
					sql`date_trunc('day', ${conversations.createdAt} AT TIME ZONE 'UTC')::date`,
				)
				.orderBy(
					sql`date_trunc('day', ${conversations.createdAt} AT TIME ZONE 'UTC')::date`,
				),

			db
				.select({
					dow: sql<number>`extract(dow from ${conversations.createdAt} AT TIME ZONE 'UTC')::int`,
					hour: sql<number>`extract(hour from ${conversations.createdAt} AT TIME ZONE 'UTC')::int`,
					count: sql<number>`count(*)::int`,
				})
				.from(conversations)
				.where(baseWhere)
				.groupBy(sql`1`, sql`2`),

			db
				.select({
					channel: conversations.channel,
					count: sql<number>`count(*)::int`,
				})
				.from(conversations)
				.where(baseWhere)
				.groupBy(conversations.channel)
				.orderBy(sql`count(*) desc`),

			db
				.select({
					tag: conversationTags.tag,
					count: sql<number>`count(*)::int`,
				})
				.from(conversationTags)
				.innerJoin(
					conversations,
					eq(conversationTags.conversationId, conversations.id),
				)
				.where(baseWhere)
				.groupBy(conversationTags.tag)
				.orderBy(sql`count(*) desc`)
				.limit(15),

			db
				.select({
					started: sql<number>`count(*)::int`,
					agent_replied: sql<number>`count(*) filter (
						where ${conversations.firstResponseAt} is not null
							or ${conversations.lastAgentReplyAt} is not null
					)::int`,
					resolved: sql<number>`count(*) filter (
						where ${conversations.status} in ('resolved', 'closed')
							or ${conversations.resolvedAt} is not null
					)::int`,
					closed: sql<number>`count(*) filter (
						where ${conversations.status} = 'closed'
							or ${conversations.closedAt} is not null
					)::int`,
				})
				.from(conversations)
				.where(baseWhere),
		]);

	const funnel = funnelRow[0] ?? {
		started: 0,
		agent_replied: 0,
		resolved: 0,
		closed: 0,
	};

	return {
		conversations_over_time: overTimeRows.map((r) => ({
			day: r.day,
			created: Number(r.created),
			resolved: Number(r.resolved),
		})),
		peak_hours: peakRows.map((r) => ({
			dow: Number(r.dow),
			hour: Number(r.hour),
			count: Number(r.count),
		})),
		channels: channelRows.map((r) => ({
			channel: String(r.channel),
			count: Number(r.count),
		})),
		top_tags: tagRows.map((r) => ({
			tag: r.tag,
			count: Number(r.count),
		})),
		funnel: {
			started: Number(funnel.started),
			agent_replied: Number(funnel.agent_replied),
			resolved: Number(funnel.resolved),
			closed: Number(funnel.closed),
		},
	};
}

export function reportsOverviewToCsv(data: ReportsOverview): string {
	const lines: string[] = ["section,key,value"];

	for (const row of data.conversations_over_time) {
		lines.push(
			`over_time,${row.day},created=${row.created};resolved=${row.resolved}`,
		);
	}
	for (const row of data.channels) {
		lines.push(`channel,${row.channel},${row.count}`);
	}
	for (const row of data.top_tags) {
		lines.push(`tag,${escapeCsv(row.tag)},${row.count}`);
	}
	for (const row of data.peak_hours) {
		lines.push(
			`peak_hour,${peakHourLabel(row.dow, row.hour)},${row.count}`,
		);
	}
	lines.push(`funnel,started,${data.funnel.started}`);
	lines.push(`funnel,agent_replied,${data.funnel.agent_replied}`);
	lines.push(`funnel,resolved,${data.funnel.resolved}`);
	lines.push(`funnel,closed,${data.funnel.closed}`);

	return lines.join("\n");
}

function escapeCsv(value: string): string {
	if (/[",\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}
