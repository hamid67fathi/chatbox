import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts, conversations } from "../db/schema/index.js";
import { notFound } from "./errors.js";

export type ContactMetadata = Record<string, unknown> & {
	bannedAt?: string;
	bannedBy?: string;
	banReason?: string;
};

export function isContactBanned(metadata: unknown): boolean {
	if (!metadata || typeof metadata !== "object") return false;
	const m = metadata as ContactMetadata;
	return typeof m.bannedAt === "string" && m.bannedAt.length > 0;
}

export function banMetadataPatch(
	existing: unknown,
	userId: string,
	reason?: string,
): ContactMetadata {
	const base =
		existing && typeof existing === "object"
			? { ...(existing as ContactMetadata) }
			: {};
	return {
		...base,
		bannedAt: new Date().toISOString(),
		bannedBy: userId,
		...(reason?.trim() ? { banReason: reason.trim() } : {}),
	};
}

export function unbanMetadataPatch(existing: unknown): ContactMetadata {
	const base =
		existing && typeof existing === "object"
			? { ...(existing as ContactMetadata) }
			: {};
	delete base.bannedAt;
	delete base.bannedBy;
	delete base.banReason;
	return base;
}

export async function banWorkspaceContact(
	workspaceId: string,
	contactId: string,
	bannedBy: string,
	reason?: string,
) {
	const existing = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, contactId),
			eq(contacts.workspaceId, workspaceId),
		),
	});
	if (!existing) throw notFound("Contact not found.");

	const [updated] = await db
		.update(contacts)
		.set({
			metadata: banMetadataPatch(existing.metadata, bannedBy, reason),
			updatedAt: new Date(),
		})
		.where(
			and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
		)
		.returning();

	await db
		.update(conversations)
		.set({ status: "closed", updatedAt: new Date() })
		.where(
			and(
				eq(conversations.workspaceId, workspaceId),
				eq(conversations.contactId, contactId),
				inArray(conversations.status, ["open", "pending"]),
			),
		);

	return updated!;
}

export async function unbanWorkspaceContact(workspaceId: string, contactId: string) {
	const existing = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.id, contactId),
			eq(contacts.workspaceId, workspaceId),
		),
	});
	if (!existing) throw notFound("Contact not found.");

	const [updated] = await db
		.update(contacts)
		.set({
			metadata: unbanMetadataPatch(existing.metadata),
			updatedAt: new Date(),
		})
		.where(
			and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
		)
		.returning();

	return updated!;
}
