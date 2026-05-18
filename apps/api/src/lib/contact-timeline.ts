import { and, desc, eq, inArray } from "drizzle-orm";
import type { SegmentChannel } from "@chatbox/shared/segments";
import { db } from "../db/index.js";
import {
	conversationNotes,
	conversationTags,
	conversations,
	messages,
} from "../db/schema/index.js";

export type TimelineEventType =
	| "conversation_started"
	| "message"
	| "note"
	| "tag_added"
	| "conversation_resolved"
	| "conversation_closed";

export interface TimelineEvent {
	id: string;
	type: TimelineEventType;
	occurred_at: string;
	conversation_id: string;
	channel: string;
	payload: Record<string, unknown>;
}

export interface TimelineFilters {
	channel?: string;
	from?: Date;
	to?: Date;
	limit?: number;
	cursor?: string;
}

const MAX_FETCH = 600;

function previewText(text: string | null | undefined, max = 160): string {
	if (!text?.trim()) return "";
	const t = text.trim();
	return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function parseCursor(cursor: string | undefined): { at: Date; id: string } | null {
	if (!cursor) return null;
	const [atRaw, id] = cursor.split("|");
	if (!atRaw || !id) return null;
	const at = new Date(atRaw);
	if (Number.isNaN(at.getTime())) return null;
	return { at, id };
}

function encodeCursor(at: Date, id: string): string {
	return `${at.toISOString()}|${id}`;
}

export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
	return [...events].sort((a, b) => {
		const ta = new Date(a.occurred_at).getTime();
		const tb = new Date(b.occurred_at).getTime();
		if (tb !== ta) return tb - ta;
		return b.id.localeCompare(a.id);
	});
}

export function filterTimelineEvents(
	events: TimelineEvent[],
	filters: Pick<TimelineFilters, "from" | "to">,
): TimelineEvent[] {
	return events.filter((e) => {
		const t = new Date(e.occurred_at);
		if (filters.from && t < filters.from) return false;
		if (filters.to && t > filters.to) return false;
		return true;
	});
}

export function paginateTimelineEvents(
	events: TimelineEvent[],
	limit: number,
	cursor: string | undefined,
): { events: TimelineEvent[]; next_cursor: string | null } {
	const sorted = sortTimelineEvents(events);
	const parsed = parseCursor(cursor);
	let start = 0;
	if (parsed) {
		start = sorted.findIndex(
			(e) =>
				new Date(e.occurred_at).getTime() < parsed.at.getTime() ||
				(new Date(e.occurred_at).getTime() === parsed.at.getTime() &&
					e.id < parsed.id),
		);
		if (start < 0) start = sorted.length;
	}
	const page = sorted.slice(start, start + limit);
	const last = page[page.length - 1];
	const next_cursor =
		start + limit < sorted.length && last
			? encodeCursor(new Date(last.occurred_at), last.id)
			: null;
	return { events: page, next_cursor };
}

export async function buildContactTimeline(
	workspaceId: string,
	contactId: string,
	filters: TimelineFilters,
): Promise<{ events: TimelineEvent[]; next_cursor: string | null }> {
	const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);

	const convConditions = [
		eq(conversations.workspaceId, workspaceId),
		eq(conversations.contactId, contactId),
	];
	if (filters.channel) {
		convConditions.push(
			eq(conversations.channel, filters.channel as SegmentChannel),
		);
	}

	const convs = await db.query.conversations.findMany({
		where: and(...convConditions),
		columns: {
			id: true,
			channel: true,
			status: true,
			subject: true,
			createdAt: true,
			resolvedAt: true,
			closedAt: true,
		},
	});

	if (convs.length === 0) {
		return { events: [], next_cursor: null };
	}

	const convIds = convs.map((c) => c.id);
	const convMap = new Map(convs.map((c) => [c.id, c]));

	const [msgRows, noteRows, tagRows] = await Promise.all([
		db
			.select({
				id: messages.id,
				conversationId: messages.conversationId,
				senderType: messages.senderType,
				type: messages.type,
				body: messages.body,
				createdAt: messages.createdAt,
			})
			.from(messages)
			.where(
				and(
					eq(messages.workspaceId, workspaceId),
					inArray(messages.conversationId, convIds),
				),
			)
			.orderBy(desc(messages.createdAt))
			.limit(MAX_FETCH),
		db.query.conversationNotes.findMany({
			where: inArray(conversationNotes.conversationId, convIds),
			with: { author: { columns: { id: true, fullName: true, email: true } } },
			orderBy: (n, { desc: d }) => [d(n.createdAt)],
			limit: MAX_FETCH,
		}),
		db
			.select({
				conversationId: conversationTags.conversationId,
				tag: conversationTags.tag,
				createdAt: conversationTags.createdAt,
			})
			.from(conversationTags)
			.where(inArray(conversationTags.conversationId, convIds))
			.limit(MAX_FETCH),
	]);

	const events: TimelineEvent[] = [];

	for (const c of convs) {
		events.push({
			id: `conv-start-${c.id}`,
			type: "conversation_started",
			occurred_at: c.createdAt.toISOString(),
			conversation_id: c.id,
			channel: c.channel,
			payload: {
				status: c.status,
				subject: c.subject,
			},
		});
		if (c.resolvedAt) {
			events.push({
				id: `conv-resolved-${c.id}`,
				type: "conversation_resolved",
				occurred_at: c.resolvedAt.toISOString(),
				conversation_id: c.id,
				channel: c.channel,
				payload: { status: "resolved" },
			});
		}
		if (c.closedAt) {
			events.push({
				id: `conv-closed-${c.id}`,
				type: "conversation_closed",
				occurred_at: c.closedAt.toISOString(),
				conversation_id: c.id,
				channel: c.channel,
				payload: { status: "closed" },
			});
		}
	}

	for (const m of msgRows) {
		const conv = convMap.get(m.conversationId);
		if (!conv) continue;
		events.push({
			id: `msg-${m.id}`,
			type: "message",
			occurred_at: m.createdAt.toISOString(),
			conversation_id: m.conversationId,
			channel: conv.channel,
			payload: {
				sender_type: m.senderType,
				message_type: m.type,
				body: previewText(m.body),
			},
		});
	}

	for (const n of noteRows) {
		const conv = convMap.get(n.conversationId);
		if (!conv) continue;
		events.push({
			id: `note-${n.id}`,
			type: "note",
			occurred_at: n.createdAt.toISOString(),
			conversation_id: n.conversationId,
			channel: conv.channel,
			payload: {
				body: previewText(n.body),
				author: n.author
					? {
							id: n.author.id,
							full_name: n.author.fullName,
							email: n.author.email,
						}
					: null,
			},
		});
	}

	for (const t of tagRows) {
		const conv = convMap.get(t.conversationId);
		if (!conv) continue;
		events.push({
			id: `tag-${t.conversationId}-${t.tag}`,
			type: "tag_added",
			occurred_at: t.createdAt.toISOString(),
			conversation_id: t.conversationId,
			channel: conv.channel,
			payload: { tag: t.tag },
		});
	}

	const filtered = filterTimelineEvents(events, filters);
	return paginateTimelineEvents(filtered, limit, filters.cursor);
}
