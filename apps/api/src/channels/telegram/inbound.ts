import { and, desc, eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { db } from "../../db/index.js";
import { contacts, conversations, messages, workspaces } from "../../db/schema/index.js";
import { isContactBanned } from "../../lib/contact-ban.js";
import { contactBanned, notFound } from "../../lib/errors.js";
import {
	assertCanCreateConversation,
	notifyPlanUsageIfNeeded,
} from "../../lib/plan-limits.js";
import {
	broadcastNewConversation,
	deliverNewMessage,
	triggerAIReply,
} from "../../lib/message-delivery.js";
import { parseTelegramIntegration } from "../../lib/telegram-settings.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
let redisClient: Redis | null = null;

function redis(): Redis {
	if (!redisClient) redisClient = new Redis(redisUrl);
	return redisClient;
}

export interface TelegramUpdate {
	update_id: number;
	message?: {
		message_id: number;
		from?: {
			id: number;
			first_name?: string;
			last_name?: string;
			username?: string;
		};
		chat: { id: number; type: string };
		text?: string;
	};
}

function displayName(from: NonNullable<TelegramUpdate["message"]>["from"]): string {
	if (!from) return "Telegram User";
	const parts = [from.first_name, from.last_name].filter(Boolean);
	if (parts.length) return parts.join(" ");
	if (from.username) return `@${from.username}`;
	return "Telegram User";
}

async function markUpdateProcessed(
	workspaceId: string,
	updateId: number,
): Promise<boolean> {
	const key = `telegram:update:${workspaceId}:${updateId}`;
	const result = await redis().set(key, "1", "EX", 86_400, "NX");
	return result === "OK";
}

async function upsertTelegramContact(
	workspaceId: string,
	telegramUserId: number,
	fullName: string,
) {
	let contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			eq(contacts.telegramId, telegramUserId),
		),
	});

	if (!contact) {
		const [created] = await db
			.insert(contacts)
			.values({
				workspaceId,
				telegramId: telegramUserId,
				fullName,
				externalId: `tg:${telegramUserId}`,
				metadata: { source: "telegram" },
			})
			.returning();
		return created;
	}

	if (contact.fullName !== fullName) {
		const [updated] = await db
			.update(contacts)
			.set({ fullName, updatedAt: new Date(), lastSeenAt: new Date() })
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

async function findOrCreateTelegramConversation(
	workspaceId: string,
	contactId: string,
	telegramChatId: number,
) {
	const existing = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
			eq(conversations.channel, "telegram"),
			eq(conversations.status, "open"),
		),
		orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
	});
	if (existing) return { conversation: existing, created: false };

	await assertCanCreateConversation(workspaceId);
	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, contactId),
	});
	if (!contact) throw notFound("Contact not found.");

	const [conv] = await db
		.insert(conversations)
		.values({
			workspaceId,
			contactId,
			channel: "telegram",
			status: "open",
			metadata: { telegram_chat_id: telegramChatId },
		})
		.returning();

	broadcastNewConversation(conv, contact);
	void notifyPlanUsageIfNeeded(workspaceId);
	return { conversation: conv, created: true };
}

export async function handleTelegramWebhook(
	workspaceId: string,
	update: TelegramUpdate,
): Promise<void> {
	if (!update.message?.text?.trim()) return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
	});
	if (!ws) throw notFound("Workspace not found.");

	const integration = parseTelegramIntegration(ws.settings);
	if (!integration?.enabled) return;

	const isNew = await markUpdateProcessed(workspaceId, update.update_id);
	if (!isNew) return;

	const from = update.message.from;
	if (!from?.id) return;

	const text = update.message.text.trim();
	const chatId = update.message.chat.id;

	const contact = await upsertTelegramContact(
		workspaceId,
		from.id,
		displayName(from),
	);

	if (isContactBanned(contact.metadata)) throw contactBanned();

	const { conversation } = await findOrCreateTelegramConversation(
		workspaceId,
		contact.id,
		chatId,
	);

	const [msg] = await db
		.insert(messages)
		.values({
			workspaceId,
			conversationId: conversation.id,
			senderType: "contact",
			senderContactId: contact.id,
			type: "text",
			body: text,
		})
		.returning();

	await deliverNewMessage(msg, conversation.id, workspaceId);
	triggerAIReply(workspaceId, conversation.id, text, msg.id);
}
