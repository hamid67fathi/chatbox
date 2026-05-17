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
import {
	normalizeWhatsappPhone,
	parseWhatsappIntegration,
} from "../../lib/whatsapp-settings.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
let redisClient: Redis | null = null;

function redis(): Redis {
	if (!redisClient) redisClient = new Redis(redisUrl);
	return redisClient;
}

export interface WhatsappWebhookPayload {
	object?: string;
	entry?: Array<{
		changes?: Array<{
			value?: {
				metadata?: { phone_number_id?: string };
				messages?: Array<{
					id: string;
					from: string;
					timestamp: string;
					type: string;
					text?: { body?: string };
				}>;
			};
		}>;
	}>;
}

async function markMessageProcessed(
	workspaceId: string,
	messageId: string,
): Promise<boolean> {
	const key = `whatsapp:msg:${workspaceId}:${messageId}`;
	const result = await redis().set(key, "1", "EX", 604_800, "NX");
	return result === "OK";
}

async function upsertWhatsappContact(
	workspaceId: string,
	waId: string,
	fullName: string,
) {
	const phone = normalizeWhatsappPhone(waId);
	let contact = await db.query.contacts.findFirst({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			eq(contacts.phone, phone),
		),
	});

	if (!contact) {
		const [created] = await db
			.insert(contacts)
			.values({
				workspaceId,
				phone,
				fullName,
				externalId: `wa:${phone}`,
				metadata: { source: "whatsapp", whatsapp_wa_id: waId },
			})
			.returning();
		return created;
	}

	await db
		.update(contacts)
		.set({ lastSeenAt: new Date(), updatedAt: new Date() })
		.where(eq(contacts.id, contact.id));

	return contact;
}

async function findOrCreateWhatsappConversation(
	workspaceId: string,
	contactId: string,
	waId: string,
) {
	const existing = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
			eq(conversations.channel, "whatsapp"),
			eq(conversations.status, "open"),
		),
		orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
	});
	if (existing) return existing;

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
			channel: "whatsapp",
			status: "open",
			subject: "WhatsApp",
			metadata: { whatsapp_wa_id: waId },
		})
		.returning();

	broadcastNewConversation(conv, contact);
	void notifyPlanUsageIfNeeded(workspaceId);
	return conv;
}

export async function handleWhatsappWebhook(
	workspaceId: string,
	payload: WhatsappWebhookPayload,
): Promise<void> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
	});
	if (!ws) throw notFound("Workspace not found.");

	const integration = parseWhatsappIntegration(ws.settings);
	if (!integration?.enabled) return;

	for (const entry of payload.entry ?? []) {
		for (const change of entry.changes ?? []) {
			const value = change.value;
			if (!value?.messages?.length) continue;

			const phoneNumberId = value.metadata?.phone_number_id;
			if (phoneNumberId && phoneNumberId !== integration.phone_number_id) {
				continue;
			}

			for (const message of value.messages) {
				if (message.type !== "text" || !message.text?.body?.trim()) continue;

				const isNew = await markMessageProcessed(workspaceId, message.id);
				if (!isNew) continue;

				const waId = message.from;
				const text = message.text.body.trim();
				const contact = await upsertWhatsappContact(
					workspaceId,
					waId,
					waId,
				);
				if (isContactBanned(contact.metadata)) throw contactBanned();

				const conv = await findOrCreateWhatsappConversation(
					workspaceId,
					contact.id,
					waId,
				);

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
		}
	}
}
