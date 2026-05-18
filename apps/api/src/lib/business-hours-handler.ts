import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations, messages, workspaces } from "../db/schema/index.js";
import {
	type BusinessHoursConfig,
	isWithinBusinessHours,
	parseBusinessHours,
} from "./business-hours.js";
import { deliverNewMessage } from "./message-delivery.js";

export async function getWorkspaceBusinessHours(
	workspaceId: string,
): Promise<BusinessHoursConfig | null> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true, timezone: true },
	});
	if (!ws) return null;
	return parseBusinessHours(ws.settings, ws.timezone);
}

export function isConversationOpenForSupport(config: BusinessHoursConfig): boolean {
	return isWithinBusinessHours(config);
}

async function sendAwayMessage(
	workspaceId: string,
	conversationId: string,
	text: string,
) {
	const body = text.trim();
	if (!body) return;

	const [msg] = await db
		.insert(messages)
		.values({
			workspaceId,
			conversationId,
			senderType: "ai",
			type: "text",
			body,
			aiModel: "business_hours",
		})
		.returning();

	await deliverNewMessage(msg, conversationId, workspaceId);
}

export async function ensureAwayMessageForConversation(
	workspaceId: string,
	conversationId: string,
): Promise<boolean> {
	const config = await getWorkspaceBusinessHours(workspaceId);
	if (!config || isWithinBusinessHours(config)) return false;

	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			eq(conversations.workspaceId, workspaceId),
		),
		columns: { metadata: true },
	});
	if (!conv) return true;

	const meta =
		conv.metadata && typeof conv.metadata === "object"
			? { ...(conv.metadata as Record<string, unknown>) }
			: {};
	if (meta.away_message_sent === true) return true;

	await sendAwayMessage(workspaceId, conversationId, config.away_message);

	meta.away_message_sent = true;
	meta.business_hours_closed = true;
	await db
		.update(conversations)
		.set({ metadata: meta, aiHandled: false, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));

	return true;
}

export async function isSupportClosed(workspaceId: string): Promise<boolean> {
	const config = await getWorkspaceBusinessHours(workspaceId);
	if (!config) return false;
	return config.enabled && !isWithinBusinessHours(config);
}
