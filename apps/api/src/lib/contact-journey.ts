import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	contactLifecycleHistory,
	contacts,
	conversations,
	visitorEvents,
} from "../db/schema/index.js";
import { retentionCutoffForPlan } from "./visitor-events.js";

export interface JourneyItem {
	id: string;
	type: string;
	occurred_at: string;
	title: string;
	detail?: string | null;
	payload?: Record<string, unknown>;
}

export async function buildContactJourney(
	workspaceId: string,
	contactId: string,
	opts: { plan: string; from?: Date; to?: Date },
): Promise<JourneyItem[]> {
	const contact = await db.query.contacts.findFirst({
		where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
	});
	if (!contact) return [];

	const cutoff = retentionCutoffForPlan(opts.plan);
	const from = opts.from ?? cutoff ?? new Date(0);
	const to = opts.to ?? new Date();

	const items: JourneyItem[] = [];

	const events = await db.query.visitorEvents.findMany({
		where: and(
			eq(visitorEvents.workspaceId, workspaceId),
			eq(visitorEvents.contactId, contactId),
			gte(visitorEvents.createdAt, from),
			lte(visitorEvents.createdAt, to),
		),
		orderBy: [desc(visitorEvents.createdAt)],
		limit: 200,
	});
	for (const e of events) {
		items.push({
			id: e.id,
			type: `event.${e.eventType}`,
			occurred_at: e.createdAt.toISOString(),
			title: e.eventType,
			detail: e.url,
			payload:
				e.payload && typeof e.payload === "object"
					? (e.payload as Record<string, unknown>)
					: {},
		});
	}

	const convs = await db.query.conversations.findMany({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
			gte(conversations.createdAt, from),
			lte(conversations.createdAt, to),
		),
		orderBy: [desc(conversations.createdAt)],
		limit: 50,
	});
	for (const c of convs) {
		items.push({
			id: c.id,
			type: "conversation",
			occurred_at: (c.createdAt ?? new Date()).toISOString(),
			title: `مکالمه ${c.channel}`,
			detail: c.status,
		});
	}

	const history = await db.query.contactLifecycleHistory.findMany({
		where: and(
			eq(contactLifecycleHistory.workspaceId, workspaceId),
			eq(contactLifecycleHistory.contactId, contactId),
		),
		orderBy: [desc(contactLifecycleHistory.changedAt)],
		limit: 50,
	});
	for (const h of history) {
		items.push({
			id: h.id,
			type: "lifecycle",
			occurred_at: h.changedAt.toISOString(),
			title: `${h.fromStage ?? "?"} → ${h.toStage}`,
			detail: h.reason,
		});
	}

	items.sort(
		(a, b) =>
			new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
	);
	return items;
}
