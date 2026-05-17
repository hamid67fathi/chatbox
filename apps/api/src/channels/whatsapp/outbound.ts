import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, conversations, messages, workspaces } from "../../db/schema/index.js";
import { parseWhatsappIntegration } from "../../lib/whatsapp-settings.js";
import { whatsappSendText } from "./api.js";

export async function deliverOutboundToWhatsapp(
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
	if (!conv || conv.channel !== "whatsapp") return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const integration = parseWhatsappIntegration(ws?.settings);
	if (!integration?.enabled) return;

	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, conv.contactId),
		columns: { phone: true, metadata: true },
	});

	const meta = (conv.metadata ?? {}) as Record<string, unknown>;
	const contactMeta = (contact?.metadata ?? {}) as Record<string, unknown>;
	const waId =
		(typeof meta.whatsapp_wa_id === "string" && meta.whatsapp_wa_id) ||
		(typeof contactMeta.whatsapp_wa_id === "string" &&
			contactMeta.whatsapp_wa_id) ||
		contact?.phone;

	if (!waId) return;

	try {
		await whatsappSendText(
			integration.phone_number_id,
			integration.access_token,
			waId,
			message.body,
		);
	} catch (err) {
		console.error("[whatsapp] outbound send failed:", err);
	}
}
