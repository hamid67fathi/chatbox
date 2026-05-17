import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contacts, conversations, messages, workspaces } from "../../db/schema/index.js";
import { parseEmailIntegration } from "../../lib/email-settings.js";
import { sendEmailViaSmtp } from "./smtp.js";

function replySubject(original: string): string {
	const trimmed = original.trim();
	if (/^re:/i.test(trimmed)) return trimmed;
	return `Re: ${trimmed}`;
}

export async function deliverOutboundToEmail(
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
	});
	if (!conv || conv.channel !== "email") return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	const integration = parseEmailIntegration(ws?.settings);
	if (!integration?.enabled) return;

	const contact = await db.query.contacts.findFirst({
		where: eq(contacts.id, conv.contactId),
		columns: { email: true },
	});
	if (!contact?.email) return;

	const meta = (conv.metadata ?? {}) as Record<string, unknown>;
	const emailSubject =
		(typeof meta.email_subject === "string" && meta.email_subject) ||
		conv.subject ||
		"پشتیبانی";
	const lastMessageId =
		typeof meta.email_last_message_id === "string"
			? meta.email_last_message_id
			: null;
	const refs = Array.isArray(meta.email_message_ids)
		? (meta.email_message_ids as string[])
				.map((id) => (id.startsWith("<") ? id : `<${id}>`))
				.join(" ")
		: lastMessageId ?? undefined;

	try {
		const { messageId } = await sendEmailViaSmtp(integration, {
			to: contact.email,
			subject: replySubject(emailSubject),
			text: message.body,
			inReplyTo: lastMessageId,
			references: refs || lastMessageId,
		});

		const norm = messageId.replace(/^<|>$/g, "").trim();
		const ids = Array.isArray(meta.email_message_ids)
			? [...(meta.email_message_ids as string[])]
			: [];
		if (norm && !ids.includes(norm)) ids.push(norm);

		await db
			.update(conversations)
			.set({
				metadata: {
					...meta,
					email_subject: emailSubject,
					email_message_ids: ids,
					email_last_message_id: messageId.startsWith("<")
						? messageId
						: `<${norm}>`,
				},
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId));
	} catch (err) {
		console.error("[email] outbound send failed:", err);
	}
}
