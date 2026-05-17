import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, conversations, messages, workspaces } from "../../db/schema/index.js";
import { parseTelegramIntegration } from "../../lib/telegram-settings.js";
import { telegramSendMessage } from "./api.js";

export async function deliverOutboundToTelegram(
	message: typeof messages.$inferSelect,
	conversationId: string,
	workspaceId: string,
): Promise<void> {
	if (message.senderType !== "agent" && message.senderType !== "ai") return;
	if (!message.body?.trim()) return;

	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			eq(conversations.workspaceId, workspaceId),
		),
		columns: { id: true, channel: true, contactId: true, metadata: true },
	});
	if (!conv || conv.channel !== "telegram") return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const integration = parseTelegramIntegration(ws?.settings);
	if (!integration?.enabled) return;

	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, conv.contactId),
		columns: { telegramId: true },
	});

	const meta = conv.metadata as Record<string, unknown> | null;
	const chatId =
		typeof meta?.telegram_chat_id === "number"
			? meta.telegram_chat_id
			: contact?.telegramId;

	if (!chatId) return;

	try {
		await telegramSendMessage(integration.bot_token, chatId, message.body);
	} catch (err) {
		console.error("[telegram] outbound send failed:", err);
	}
}
