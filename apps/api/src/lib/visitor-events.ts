import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { contacts, visitorEvents, visitorIdentities } from "../db/schema/index.js";
import { findContactByVisitorId } from "./identity-resolution.js";
import { clientIp } from "./visitor-context.js";

export const VISITOR_EVENT_TYPES = [
	"page_view",
	"session_start",
	"session_end",
	"conversation_started",
	"custom_event",
] as const;

export type VisitorEventType = (typeof VISITOR_EVENT_TYPES)[number];

const EVENT_SET = new Set<string>(VISITOR_EVENT_TYPES);

export function isVisitorEventType(value: string): value is VisitorEventType {
	return EVENT_SET.has(value);
}

export function retentionCutoffForPlan(plan: string): Date | null {
	const now = new Date();
	if (plan === "enterprise") return null;
	if (plan === "pro") {
		const d = new Date(now);
		d.setMonth(d.getMonth() - 24);
		return d;
	}
	const d = new Date(now);
	d.setMonth(d.getMonth() - 6);
	return d;
}

export interface RecordVisitorEventInput {
	workspaceId: string;
	visitorId: string;
	eventType: VisitorEventType;
	url?: string | null;
	referrer?: string | null;
	payload?: Record<string, unknown>;
	contactId?: string | null;
	ip?: string | null;
	userAgent?: string | null;
}

export async function recordVisitorEvent(
	input: RecordVisitorEventInput,
): Promise<void> {
	const visitorId = input.visitorId.trim();
	if (!visitorId) return;

	let contactId = input.contactId ?? null;
	if (!contactId) {
		const contact = await findContactByVisitorId(
			input.workspaceId,
			visitorId,
		);
		contactId = contact?.id ?? null;
	}

	await db.insert(visitorEvents).values({
		workspaceId: input.workspaceId,
		visitorId,
		contactId,
		eventType: input.eventType,
		url: input.url?.trim().slice(0, 2048) ?? null,
		referrer: input.referrer?.trim().slice(0, 2048) ?? null,
		payload: input.payload ?? {},
		ip: input.ip?.slice(0, 64) ?? null,
		userAgent: input.userAgent?.slice(0, 512) ?? null,
	});
}

export function trackContextFromRequest(request: FastifyRequest): {
	ip: string | null;
	userAgent: string | null;
} {
	const ua =
		typeof request.headers["user-agent"] === "string"
			? request.headers["user-agent"]
			: null;
	return { ip: clientIp(request), userAgent: ua };
}

export interface VisitorEventRow {
	id: string;
	event_type: string;
	url: string | null;
	referrer: string | null;
	payload: Record<string, unknown>;
	visitor_id: string;
	created_at: string;
}

function parseEventsCursor(cursor: string | undefined): {
	at: Date;
	id: string;
} | null {
	if (!cursor) return null;
	const [atRaw, id] = cursor.split("|");
	if (!atRaw || !id) return null;
	const at = new Date(atRaw);
	if (Number.isNaN(at.getTime())) return null;
	return { at, id };
}

function encodeEventsCursor(at: Date, id: string): string {
	return `${at.toISOString()}|${id}`;
}

export async function listContactVisitorEvents(
	workspaceId: string,
	contactId: string,
	opts: {
		plan: string;
		limit?: number;
		cursor?: string;
	},
): Promise<{ rows: VisitorEventRow[]; next_cursor: string | null }> {
	const contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, contactId),
			eq(contacts.workspaceId, workspaceId),
		),
		columns: { id: true, externalId: true },
	});

	if (!contact) return { rows: [], next_cursor: null };

	const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
	const cutoff = retentionCutoffForPlan(opts.plan);
	const parsed = parseEventsCursor(opts.cursor);

	const links = await db.query.visitorIdentities.findMany({
		where: and(
			eq(visitorIdentities.workspaceId, workspaceId),
			eq(visitorIdentities.contactId, contactId),
		),
		columns: { visitorId: true },
	});

	const visitorIds = new Set<string>();
	if (contact.externalId) visitorIds.add(contact.externalId);
	for (const link of links) visitorIds.add(link.visitorId);

	const matchVisitor =
		visitorIds.size > 0
			? inArray(visitorEvents.visitorId, [...visitorIds])
			: undefined;

	const matchContact = eq(visitorEvents.contactId, contactId);
	const scope = matchVisitor ? or(matchContact, matchVisitor) : matchContact;

	const conditions = [eq(visitorEvents.workspaceId, workspaceId), scope];
	if (cutoff) conditions.push(gte(visitorEvents.createdAt, cutoff));

	let rows = await db.query.visitorEvents.findMany({
		where: and(...conditions),
		orderBy: [desc(visitorEvents.createdAt), desc(visitorEvents.id)],
		limit: limit + 1,
	});

	if (parsed) {
		rows = rows.filter((r) => {
			const t = r.createdAt.getTime();
			const p = parsed.at.getTime();
			return t < p || (t === p && r.id < parsed.id);
		});
	}

	const page = rows.slice(0, limit);
	const hasMore = rows.length > limit;
	const next =
		hasMore && page.length > 0
			? encodeEventsCursor(
					page[page.length - 1]!.createdAt,
					page[page.length - 1]!.id,
				)
			: null;

	return {
		rows: page.map((r) => ({
			id: r.id,
			event_type: r.eventType,
			url: r.url,
			referrer: r.referrer,
			payload:
				r.payload && typeof r.payload === "object"
					? (r.payload as Record<string, unknown>)
					: {},
			visitor_id: r.visitorId,
			created_at: r.createdAt.toISOString(),
		})),
		next_cursor: next,
	};
}
