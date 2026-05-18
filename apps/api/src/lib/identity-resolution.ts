import { and, eq, ne, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	contacts,
	conversations,
	csatResponses,
	flowSessions,
	messages,
	visitorIdentities,
} from "../db/schema/index.js";
import { notFound, validationError } from "./errors.js";

export type IdentityMethod =
	| "cookie"
	| "fingerprint"
	| "email"
	| "phone"
	| "prechat"
	| "api";

export function normalizeEmail(email: string | null | undefined): string | null {
	if (!email || typeof email !== "string") return null;
	const v = email.trim().toLowerCase();
	return v.length > 0 ? v : null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
	if (!phone || typeof phone !== "string") return null;
	const digits = phone.replace(/\s+/g, "").trim();
	return digits.length > 0 ? digits : null;
}

export async function findContactByVisitorId(
	workspaceId: string,
	visitorId: string,
) {
	const link = await db.query.visitorIdentities.findFirst({
		where: and(
			eq(visitorIdentities.workspaceId, workspaceId),
			eq(visitorIdentities.visitorId, visitorId),
		),
	});
	if (link) {
		const byLink = await db.query.contacts.findFirst({
			where: and(
				eq(contacts.id, link.contactId),
				eq(contacts.workspaceId, workspaceId),
			),
		});
		if (byLink) return byLink;
	}

	return db.query.contacts.findFirst({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			eq(contacts.externalId, visitorId),
		),
	});
}

export async function linkVisitorToContact(
	workspaceId: string,
	visitorId: string,
	contactId: string,
	method: IdentityMethod,
): Promise<void> {
	const vid = visitorId.trim();
	if (!vid) return;

	await db
		.insert(visitorIdentities)
		.values({
			workspaceId,
			visitorId: vid,
			contactId,
			method,
		})
		.onConflictDoUpdate({
			target: [visitorIdentities.workspaceId, visitorIdentities.visitorId],
			set: {
				contactId,
				method,
				identifiedAt: new Date(),
			},
		});
}

async function findCanonicalByEmailOrPhone(
	workspaceId: string,
	email: string | null,
	phone: string | null,
	excludeContactId?: string,
) {
	const conditions = [eq(contacts.workspaceId, workspaceId)];
	if (excludeContactId) {
		conditions.push(ne(contacts.id, excludeContactId));
	}

	const matchers = [];
	if (email) matchers.push(eq(contacts.email, email));
	if (phone) matchers.push(eq(contacts.phone, phone));
	if (matchers.length === 0) return null;

	return db.query.contacts.findFirst({
		where: and(...conditions, or(...matchers)),
	});
}

function mergeMetadata(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const out = { ...target };
	for (const [k, v] of Object.entries(source)) {
		if (v === undefined || v === null) continue;
		if (k === "visitor" && out.visitor && typeof v === "object") {
			out.visitor = {
				...(out.visitor as Record<string, unknown>),
				...(v as Record<string, unknown>),
			};
		} else if (out[k] === undefined) {
			out[k] = v;
		}
	}
	return out;
}

export async function mergeContacts(
	workspaceId: string,
	sourceContactId: string,
	targetContactId: string,
	opts: { visitorId?: string | null; method: IdentityMethod },
): Promise<void> {
	if (sourceContactId === targetContactId) return;

	await db.transaction(async (tx) => {
		const [source, target] = await Promise.all([
			tx.query.contacts.findFirst({
				where: and(
					eq(contacts.id, sourceContactId),
					eq(contacts.workspaceId, workspaceId),
				),
			}),
			tx.query.contacts.findFirst({
				where: and(
					eq(contacts.id, targetContactId),
					eq(contacts.workspaceId, workspaceId),
				),
			}),
		]);

		if (!source || !target) throw notFound("Contact not found for merge.");

		await tx
			.update(conversations)
			.set({ contactId: targetContactId })
			.where(
				and(
					eq(conversations.workspaceId, workspaceId),
					eq(conversations.contactId, sourceContactId),
				),
			);

		await tx
			.update(messages)
			.set({ senderContactId: targetContactId })
			.where(
				and(
					eq(messages.workspaceId, workspaceId),
					eq(messages.senderContactId, sourceContactId),
				),
			);

		await tx
			.update(csatResponses)
			.set({ contactId: targetContactId })
			.where(
				and(
					eq(csatResponses.workspaceId, workspaceId),
					eq(csatResponses.contactId, sourceContactId),
				),
			);

		await tx
			.update(flowSessions)
			.set({ contactId: targetContactId })
			.where(
				and(
					eq(flowSessions.workspaceId, workspaceId),
					eq(flowSessions.contactId, sourceContactId),
				),
			);

		const mergedTags = [
			...new Set([...(target.tags ?? []), ...(source.tags ?? [])]),
		];
		const sourceMeta =
			source.metadata && typeof source.metadata === "object"
				? (source.metadata as Record<string, unknown>)
				: {};
		const targetMeta =
			target.metadata && typeof target.metadata === "object"
				? (target.metadata as Record<string, unknown>)
				: {};

		await tx
			.update(contacts)
			.set({
				fullName: target.fullName ?? source.fullName,
				email: target.email ?? source.email,
				phone: target.phone ?? source.phone,
				avatarUrl: target.avatarUrl ?? source.avatarUrl,
				tags: mergedTags,
				metadata: mergeMetadata(targetMeta, sourceMeta),
				firstSeenAt:
					source.firstSeenAt < target.firstSeenAt
						? source.firstSeenAt
						: target.firstSeenAt,
				lastSeenAt:
					source.lastSeenAt > target.lastSeenAt
						? source.lastSeenAt
						: target.lastSeenAt,
				updatedAt: new Date(),
			})
			.where(eq(contacts.id, targetContactId));

		const visitorIds = new Set<string>();
		if (source.externalId) visitorIds.add(source.externalId);
		if (opts.visitorId?.trim()) visitorIds.add(opts.visitorId.trim());

		for (const vid of visitorIds) {
			await tx
				.insert(visitorIdentities)
				.values({
					workspaceId,
					visitorId: vid,
					contactId: targetContactId,
					method: opts.method,
				})
				.onConflictDoUpdate({
					target: [
						visitorIdentities.workspaceId,
						visitorIdentities.visitorId,
					],
					set: {
						contactId: targetContactId,
						method: opts.method,
						identifiedAt: new Date(),
					},
				});
		}

		await tx
			.delete(contacts)
			.where(
				and(
					eq(contacts.id, sourceContactId),
					eq(contacts.workspaceId, workspaceId),
				),
			);
	});
}

export async function resolveContactIdentity(
	workspaceId: string,
	opts: {
		sourceContactId: string;
		email?: string | null;
		phone?: string | null;
		visitorId?: string | null;
		method: IdentityMethod;
	},
): Promise<{
	contactId: string;
	merged: boolean;
	mergedFromContactId?: string;
}> {
	const email = normalizeEmail(opts.email);
	const phone = normalizePhone(opts.phone);

	const source = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, opts.sourceContactId),
			eq(contacts.workspaceId, workspaceId),
		),
	});
	if (!source) throw notFound("Contact not found.");

	if (opts.visitorId?.trim()) {
		await linkVisitorToContact(
			workspaceId,
			opts.visitorId.trim(),
			source.id,
			opts.method,
		);
	} else if (source.externalId) {
		await linkVisitorToContact(
			workspaceId,
			source.externalId,
			source.id,
			opts.method,
		);
	}

	const canonical = await findCanonicalByEmailOrPhone(
		workspaceId,
		email,
		phone,
		source.id,
	);

	if (!canonical) {
		if (email || phone) {
			await db
				.update(contacts)
				.set({
					...(email ? { email } : {}),
					...(phone ? { phone } : {}),
					updatedAt: new Date(),
				})
				.where(eq(contacts.id, source.id));
		}
		return { contactId: source.id, merged: false };
	}

	if (canonical.id === source.id) {
		return { contactId: source.id, merged: false };
	}

	await mergeContacts(workspaceId, source.id, canonical.id, {
		visitorId: opts.visitorId ?? source.externalId,
		method: opts.method,
	});

	return {
		contactId: canonical.id,
		merged: true,
		mergedFromContactId: source.id,
	};
}

export async function identifyByVisitorId(
	workspaceId: string,
	body: {
		visitor_id: string;
		email?: string;
		phone?: string;
		contact_id?: string;
	},
): Promise<{
	contact_id: string;
	merged: boolean;
	merged_from_contact_id?: string;
}> {
	const visitorId = body.visitor_id?.trim();
	if (!visitorId) {
		throw validationError("visitor_id is required.", "visitor_id");
	}

	let sourceContactId = body.contact_id;
	if (!sourceContactId) {
		const found = await findContactByVisitorId(workspaceId, visitorId);
		if (!found) {
			throw notFound("No contact found for this visitor_id.");
		}
		sourceContactId = found.id;
	}

	const result = await resolveContactIdentity(workspaceId, {
		sourceContactId,
		email: body.email,
		phone: body.phone,
		visitorId,
		method: "api",
	});

	return {
		contact_id: result.contactId,
		merged: result.merged,
		merged_from_contact_id: result.mergedFromContactId,
	};
}
