import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts, conversations } from "../db/schema/index.js";
import {
	getOnlineVisitorIds,
	getVisitorPresenceMeta,
	removeVisitorPresenceMeta,
	setVisitorPresenceMeta,
} from "./presence.js";
import {
	pageViewsFromMetadata,
	visitorFromMetadata,
} from "./visitor-context.js";

export interface OnlineVisitorRow {
	contact_id: string;
	full_name: string | null;
	ip: string | null;
	country: string | null;
	country_code: string | null;
	device: string | null;
	visit_count: number;
	connected_at: string;
	duration_sec: number;
	current_page_url: string | null;
	current_page_title: string | null;
	conversation_id: string | null;
}

export async function syncVisitorPresenceFromContact(
	workspaceId: string,
	contactId: string,
): Promise<void> {
	const contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, contactId),
			eq(contacts.workspaceId, workspaceId),
		),
	});
	if (!contact) return;

	const visitor = visitorFromMetadata(contact.metadata);
	const pageViews = pageViewsFromMetadata(contact.metadata);
	const openConv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
			eq(conversations.status, "open"),
		),
		orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
	});

	const now = new Date().toISOString();
	const existing = await getVisitorPresenceMeta(workspaceId, contactId);

	await setVisitorPresenceMeta(workspaceId, contactId, {
		contact_id: contactId,
		connected_at: existing?.connected_at ?? now,
		last_seen_at: now,
		ip: visitor?.ip ?? existing?.ip ?? null,
		country: visitor?.country ?? existing?.country ?? null,
		country_code: visitor?.countryCode ?? existing?.country_code ?? null,
		device: visitor?.device ?? existing?.device ?? null,
		browser: visitor?.browser ?? existing?.browser ?? null,
		page_url: visitor?.currentPageUrl ?? existing?.page_url ?? null,
		page_title: existing?.page_title ?? null,
		visit_count: Math.max(pageViews.length, 1),
		conversation_id: openConv?.id ?? existing?.conversation_id ?? null,
	});
}

export async function patchVisitorPresence(
	workspaceId: string,
	contactId: string,
	patch: {
		page_url?: string | null;
		page_title?: string | null;
	},
): Promise<void> {
	const existing = await getVisitorPresenceMeta(workspaceId, contactId);
	if (!existing) {
		await syncVisitorPresenceFromContact(workspaceId, contactId);
	}
	const base =
		(await getVisitorPresenceMeta(workspaceId, contactId)) ?? {
			contact_id: contactId,
			connected_at: new Date().toISOString(),
			last_seen_at: new Date().toISOString(),
			visit_count: 1,
		};

	await setVisitorPresenceMeta(workspaceId, contactId, {
		...base,
		page_url: patch.page_url ?? base.page_url ?? null,
		page_title: patch.page_title ?? base.page_title ?? null,
		last_seen_at: new Date().toISOString(),
	});
}

export async function clearVisitorPresence(
	workspaceId: string,
	contactId: string,
): Promise<void> {
	await removeVisitorPresenceMeta(workspaceId, contactId);
}

export async function listOnlineVisitors(
	workspaceId: string,
): Promise<OnlineVisitorRow[]> {
	const ids = await getOnlineVisitorIds(workspaceId);
	if (ids.length === 0) return [];

	const contactRows = await db.query.contacts.findMany({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			inArray(contacts.id, ids),
		),
	});

	const openConvs = await db.query.conversations.findMany({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			inArray(conversations.contactId, ids),
			eq(conversations.status, "open"),
		),
		orderBy: [desc(conversations.lastMessageAt)],
	});

	const convByContact = new Map<string, string>();
	for (const c of openConvs) {
		if (!convByContact.has(c.contactId)) {
			convByContact.set(c.contactId, c.id);
		}
	}

	const contactById = new Map(contactRows.map((c) => [c.id, c]));
	const now = Date.now();
	const rows: OnlineVisitorRow[] = [];

	for (const contactId of ids) {
		const meta = await getVisitorPresenceMeta(workspaceId, contactId);
		const contact = contactById.get(contactId);
		const visitor = contact
			? visitorFromMetadata(contact.metadata)
			: null;
		const pageViews = contact
			? pageViewsFromMetadata(contact.metadata)
			: [];

		const connectedAt = meta?.connected_at ?? new Date().toISOString();
		const durationSec = Math.max(
			0,
			Math.floor((now - new Date(connectedAt).getTime()) / 1000),
		);

		rows.push({
			contact_id: contactId,
			full_name: contact?.fullName ?? null,
			ip: meta?.ip ?? visitor?.ip ?? null,
			country: meta?.country ?? visitor?.country ?? null,
			country_code: meta?.country_code ?? visitor?.countryCode ?? null,
			device: meta?.device ?? visitor?.device ?? null,
			visit_count: Math.max(
				meta?.visit_count ?? 0,
				pageViews.length,
				1,
			),
			connected_at: connectedAt,
			duration_sec: durationSec,
			current_page_url:
				meta?.page_url ?? visitor?.currentPageUrl ?? null,
			current_page_title: meta?.page_title ?? null,
			conversation_id:
				meta?.conversation_id ??
				convByContact.get(contactId) ??
				null,
		});
	}

	rows.sort(
		(a, b) =>
			new Date(b.connected_at).getTime() -
			new Date(a.connected_at).getTime(),
	);

	return rows;
}
