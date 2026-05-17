import { and, desc, eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { db } from "../../db/index.js";
import { contacts, conversations, messages } from "../../db/schema/index.js";
import { isContactBanned } from "../../lib/contact-ban.js";
import { contactBanned } from "../../lib/errors.js";
import {
	assertCanCreateConversation,
	notifyPlanUsageIfNeeded,
} from "../../lib/plan-limits.js";
import {
	broadcastNewConversation,
	deliverNewMessage,
	triggerAIReply,
} from "../../lib/message-delivery.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
let redisClient: Redis | null = null;

function redis(): Redis {
	if (!redisClient) redisClient = new Redis(redisUrl);
	return redisClient;
}

export interface ParsedInboundEmail {
	from_email: string;
	from_name: string | null;
	subject: string;
	text: string;
	message_id: string;
	in_reply_to: string | null;
	references: string | null;
}

function normalizeMessageId(id: string): string {
	return id.replace(/^<|>$/g, "").trim().toLowerCase();
}

function collectThreadIds(parsed: ParsedInboundEmail): Set<string> {
	const ids = new Set<string>();
	if (parsed.in_reply_to) ids.add(normalizeMessageId(parsed.in_reply_to));
	if (parsed.references) {
		for (const part of parsed.references.split(/\s+/)) {
			const n = normalizeMessageId(part);
			if (n) ids.add(n);
		}
	}
	return ids;
}

async function markEmailProcessed(
	workspaceId: string,
	messageId: string,
): Promise<boolean> {
	const key = `email:msg:${workspaceId}:${normalizeMessageId(messageId)}`;
	const result = await redis().set(key, "1", "EX", 604_800, "NX");
	return result === "OK";
}

async function upsertEmailContact(
	workspaceId: string,
	email: string,
	fullName: string | null,
) {
	const normalized = email.trim().toLowerCase();
	let contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			eq(contacts.email, normalized),
		),
	});

	if (!contact) {
		const [created] = await db
			.insert(contacts)
			.values({
				workspaceId,
				email: normalized,
				fullName: fullName ?? normalized,
				externalId: `email:${normalized}`,
				metadata: { source: "email" },
			})
			.returning();
		return created;
	}

	const nextName = fullName?.trim() || contact.fullName;
	if (nextName && nextName !== contact.fullName) {
		const [updated] = await db
			.update(contacts)
			.set({
				fullName: nextName,
				lastSeenAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(contacts.id, contact.id))
			.returning();
		return updated ?? contact;
	}

	await db
		.update(contacts)
		.set({ lastSeenAt: new Date(), updatedAt: new Date() })
		.where(eq(contacts.id, contact.id));

	return contact;
}

function messageIdsFromMeta(meta: Record<string, unknown> | null): string[] {
	if (!meta || !Array.isArray(meta.email_message_ids)) return [];
	return meta.email_message_ids.filter((x): x is string => typeof x === "string");
}

async function findEmailConversation(
	workspaceId: string,
	contactId: string,
	threadIds: Set<string>,
) {
	if (threadIds.size > 0) {
		const convs = await db.query.conversations.findMany({
			where: and(
				eq(conversations.workspaceId, workspaceId),
				eq(conversations.contactId, contactId),
				eq(conversations.channel, "email"),
			),
			orderBy: [desc(conversations.lastMessageAt)],
			limit: 30,
		});
		for (const conv of convs) {
			const meta = (conv.metadata ?? {}) as Record<string, unknown>;
			const stored = messageIdsFromMeta(meta).map(normalizeMessageId);
			if (stored.some((id) => threadIds.has(id))) return conv;
		}
	}

	return db.query.conversations.findFirst({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
			eq(conversations.channel, "email"),
			eq(conversations.status, "open"),
		),
		orderBy: [desc(conversations.lastMessageAt)],
	});
}

function appendMessageId(
	meta: Record<string, unknown> | null,
	messageId: string,
	subject: string,
): Record<string, unknown> {
	const base = meta && typeof meta === "object" ? { ...meta } : {};
	const ids = messageIdsFromMeta(base);
	const norm = messageId.replace(/^<|>$/g, "").trim();
	if (norm && !ids.includes(norm)) ids.push(norm);
	return {
		...base,
		email_subject: subject,
		email_message_ids: ids,
		email_last_message_id: norm ? `<${norm.replace(/^<|>$/g, "")}>` : null,
	};
}

export async function handleInboundEmail(
	workspaceId: string,
	parsed: ParsedInboundEmail,
): Promise<void> {
	const text = parsed.text.trim();
	if (!text || !parsed.from_email.trim()) return;

	const messageId = parsed.message_id.trim();
	if (!messageId) return;

	const isNew = await markEmailProcessed(workspaceId, messageId);
	if (!isNew) return;

	const contact = await upsertEmailContact(
		workspaceId,
		parsed.from_email,
		parsed.from_name,
	);
	if (isContactBanned(contact.metadata)) throw contactBanned();

	const threadIds = collectThreadIds(parsed);
	let conv = await findEmailConversation(workspaceId, contact.id, threadIds);

	if (!conv) {
		await assertCanCreateConversation(workspaceId);
		const subject = parsed.subject.trim() || "ایمیل پشتیبانی";
		const [newConv] = await db
			.insert(conversations)
			.values({
				workspaceId,
				contactId: contact.id,
				channel: "email",
				status: "open",
				subject,
				metadata: appendMessageId(null, messageId, subject),
			})
			.returning();
		conv = newConv;
		broadcastNewConversation(conv, contact);
		void notifyPlanUsageIfNeeded(workspaceId);
	} else {
		const meta = appendMessageId(
			(conv.metadata as Record<string, unknown>) ?? null,
			messageId,
			parsed.subject.trim() ||
				(typeof (conv.metadata as Record<string, unknown>)?.email_subject ===
				"string"
					? ((conv.metadata as Record<string, unknown>).email_subject as string)
					: conv.subject ?? "ایمیل"),
		);
		await db
			.update(conversations)
			.set({ metadata: meta, updatedAt: new Date() })
			.where(eq(conversations.id, conv.id));
	}

	const [msg] = await db
		.insert(messages)
		.values({
			workspaceId,
			conversationId: conv.id,
			senderType: "contact",
			senderContactId: contact.id,
			type: "text",
			body: text,
		})
		.returning();

	await deliverNewMessage(msg, conv.id, workspaceId);
	triggerAIReply(workspaceId, conv.id, text, msg.id);
}
