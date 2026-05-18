import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts, conversations } from "../db/schema/index.js";
import {
	banWorkspaceContact,
	unbanWorkspaceContact,
} from "./contact-ban.js";
import { notFound, validationError } from "./errors.js";

export type BulkAction =
	| { action: "add_tags"; contact_ids: string[]; tags: string[] }
	| { action: "remove_tags"; contact_ids: string[]; tags: string[] }
	| { action: "ban"; contact_ids: string[]; reason?: string }
	| { action: "unban"; contact_ids: string[] }
	| { action: "merge"; primary_id: string; merge_ids: string[] };

export interface BulkResult {
	processed: number;
	failed: number;
	errors?: string[];
}

export interface ImportRow {
	full_name?: string | null;
	email?: string | null;
	phone?: string | null;
	tags?: string[];
	external_id?: string | null;
}

export interface ImportResult {
	created: number;
	skipped: number;
	errors: string[];
}

const MAX_BULK = 200;
const MAX_IMPORT = 500;

function normalizeTags(tags: unknown): string[] {
	if (!Array.isArray(tags)) return [];
	return [
		...new Set(
			tags
				.filter(
					(t): t is string =>
						typeof t === "string" && t.trim().length > 0,
				)
				.map((t) => t.trim()),
		),
	];
}

function unionTags(existing: string[], add: string[]): string[] {
	return [...new Set([...existing, ...add])];
}

function removeTags(existing: string[], remove: string[]): string[] {
	const drop = new Set(remove);
	return existing.filter((t) => !drop.has(t));
}

async function loadContacts(workspaceId: string, ids: string[]) {
	if (ids.length === 0) return [];
	return db.query.contacts.findMany({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			inArray(contacts.id, ids),
		),
	});
}

export async function applyContactBulkAction(
	workspaceId: string,
	userId: string,
	payload: BulkAction,
): Promise<BulkResult> {
	switch (payload.action) {
		case "add_tags":
			return bulkAddTags(workspaceId, payload.contact_ids, payload.tags);
		case "remove_tags":
			return bulkRemoveTags(workspaceId, payload.contact_ids, payload.tags);
		case "ban":
			return bulkBan(workspaceId, userId, payload.contact_ids, payload.reason);
		case "unban":
			return bulkUnban(workspaceId, payload.contact_ids);
		case "merge":
			return mergeContacts(
				workspaceId,
				payload.primary_id,
				payload.merge_ids,
			);
		default:
			throw validationError("Unknown bulk action.", "action");
	}
}

async function bulkAddTags(
	workspaceId: string,
	contactIds: string[],
	tags: string[],
): Promise<BulkResult> {
	const ids = [...new Set(contactIds)].slice(0, MAX_BULK);
	const tagList = normalizeTags(tags);
	if (!tagList.length) throw validationError("tags required.", "tags");
	if (!ids.length) throw validationError("contact_ids required.", "contact_ids");

	const rows = await loadContacts(workspaceId, ids);
	let processed = 0;
	for (const row of rows) {
		await db
			.update(contacts)
			.set({
				tags: unionTags(row.tags ?? [], tagList),
				updatedAt: new Date(),
			})
			.where(eq(contacts.id, row.id));
		processed++;
	}
	return { processed, failed: ids.length - processed };
}

async function bulkRemoveTags(
	workspaceId: string,
	contactIds: string[],
	tags: string[],
): Promise<BulkResult> {
	const ids = [...new Set(contactIds)].slice(0, MAX_BULK);
	const tagList = normalizeTags(tags);
	if (!tagList.length) throw validationError("tags required.", "tags");

	const rows = await loadContacts(workspaceId, ids);
	let processed = 0;
	for (const row of rows) {
		await db
			.update(contacts)
			.set({
				tags: removeTags(row.tags ?? [], tagList),
				updatedAt: new Date(),
			})
			.where(eq(contacts.id, row.id));
		processed++;
	}
	return { processed, failed: ids.length - processed };
}

async function bulkBan(
	workspaceId: string,
	userId: string,
	contactIds: string[],
	reason?: string,
): Promise<BulkResult> {
	const ids = [...new Set(contactIds)].slice(0, MAX_BULK);
	const errors: string[] = [];
	let processed = 0;
	for (const id of ids) {
		try {
			await banWorkspaceContact(workspaceId, id, userId, reason);
			processed++;
		} catch {
			errors.push(id);
		}
	}
	return { processed, failed: ids.length - processed, errors };
}

async function bulkUnban(
	workspaceId: string,
	contactIds: string[],
): Promise<BulkResult> {
	const ids = [...new Set(contactIds)].slice(0, MAX_BULK);
	const errors: string[] = [];
	let processed = 0;
	for (const id of ids) {
		try {
			await unbanWorkspaceContact(workspaceId, id);
			processed++;
		} catch {
			errors.push(id);
		}
	}
	return { processed, failed: ids.length - processed, errors };
}

export async function mergeContacts(
	workspaceId: string,
	primaryId: string,
	mergeIds: string[],
): Promise<BulkResult> {
	const secondary = [...new Set(mergeIds.filter((id) => id !== primaryId))].slice(
		0,
		MAX_BULK,
	);
	if (!secondary.length) {
		throw validationError("merge_ids required.", "merge_ids");
	}

	const primary = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, primaryId),
			eq(contacts.workspaceId, workspaceId),
		),
	});
	if (!primary) throw notFound("Primary contact not found.");

	const others = await loadContacts(workspaceId, secondary);
	if (others.length === 0) {
		return { processed: 0, failed: secondary.length };
	}

	let mergedTags = [...(primary.tags ?? [])];
	let fullName = primary.fullName;
	let email = primary.email;
	let phone = primary.phone;
	let externalId = primary.externalId;
	const metadata = {
		...(typeof primary.metadata === "object" && primary.metadata
			? (primary.metadata as Record<string, unknown>)
			: {}),
	};

	for (const row of others) {
		await db
			.update(conversations)
			.set({ contactId: primaryId, updatedAt: new Date() })
			.where(
				and(
					eq(conversations.workspaceId, workspaceId),
					eq(conversations.contactId, row.id),
				),
			);

		mergedTags = unionTags(mergedTags, row.tags ?? []);
		if (!fullName && row.fullName) fullName = row.fullName;
		if (!email && row.email) email = row.email;
		if (!phone && row.phone) phone = row.phone;
		if (!externalId && row.externalId) externalId = row.externalId;
	}

	await db
		.update(contacts)
		.set({
			fullName,
			email,
			phone,
			externalId,
			tags: mergedTags,
			metadata,
			updatedAt: new Date(),
		})
		.where(eq(contacts.id, primaryId));

	await db
		.delete(contacts)
		.where(
			and(
				eq(contacts.workspaceId, workspaceId),
				inArray(
					contacts.id,
					others.map((o) => o.id),
				),
			),
		);

	return { processed: others.length, failed: secondary.length - others.length };
}

export function contactsToCsv(
	rows: Array<{
		id: string;
		fullName: string | null;
		email: string | null;
		phone: string | null;
		tags: string[];
		firstSeenAt: Date;
		lastSeenAt: Date;
		metadata: unknown;
	}>,
): string {
	const header = "id,full_name,email,phone,tags,first_seen_at,last_seen_at,banned";
	const lines = rows.map((r) => {
		const banned =
			typeof r.metadata === "object" &&
			r.metadata &&
			typeof (r.metadata as { bannedAt?: string }).bannedAt === "string"
				? "yes"
				: "no";
		return [
			escapeCsv(r.id),
			escapeCsv(r.fullName ?? ""),
			escapeCsv(r.email ?? ""),
			escapeCsv(r.phone ?? ""),
			escapeCsv((r.tags ?? []).join("|")),
			escapeCsv(r.firstSeenAt.toISOString()),
			escapeCsv(r.lastSeenAt.toISOString()),
			banned,
		].join(",");
	});
	return [header, ...lines].join("\n");
}

function escapeCsv(val: string): string {
	if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
	return val;
}

export async function importContacts(
	workspaceId: string,
	rows: ImportRow[],
): Promise<ImportResult> {
	const slice = rows.slice(0, MAX_IMPORT);
	let created = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (let i = 0; i < slice.length; i++) {
		const row = slice[i]!;
		const fullName = row.full_name?.trim() || null;
		const email = row.email?.trim() || null;
		const phone = row.phone?.trim() || null;
		const externalId = row.external_id?.trim() || null;
		const tags = normalizeTags(row.tags);

		if (!fullName && !email && !phone) {
			errors.push(`Row ${i + 1}: missing name/email/phone`);
			skipped++;
			continue;
		}

		if (email) {
			const dup = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.workspaceId, workspaceId),
					eq(contacts.email, email),
				),
				columns: { id: true },
			});
			if (dup) {
				skipped++;
				continue;
			}
		}

		if (phone) {
			const dup = await db.query.contacts.findFirst({
				where: and(
					eq(contacts.workspaceId, workspaceId),
					eq(contacts.phone, phone),
				),
				columns: { id: true },
			});
			if (dup) {
				skipped++;
				continue;
			}
		}

		try {
			await db.insert(contacts).values({
				workspaceId,
				fullName,
				email,
				phone,
				externalId,
				tags,
				metadata: {},
			});
			created++;
		} catch (e) {
			errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "insert failed"}`);
			skipped++;
		}
	}

	return { created, skipped, errors };
}

export async function exportContacts(
	workspaceId: string,
	contactIds?: string[],
): Promise<string> {
	const where = contactIds?.length
		? and(
				eq(contacts.workspaceId, workspaceId),
				inArray(contacts.id, contactIds.slice(0, MAX_BULK)),
			)
		: eq(contacts.workspaceId, workspaceId);

	const rows = await db.query.contacts.findMany({
		where,
		limit: MAX_BULK,
		orderBy: (c, { desc }) => [desc(c.lastSeenAt)],
	});

	return contactsToCsv(rows);
}
