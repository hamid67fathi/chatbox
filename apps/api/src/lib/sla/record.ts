import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { conversations, messages } from "../../db/schema/index.js";

export async function recordFirstResponseIfNeeded(
	conversationId: string,
	message: typeof messages.$inferSelect,
): Promise<void> {
	if (message.senderType !== "agent" && message.senderType !== "ai") return;

	const conv = await db.query.conversations.findFirst({
		where: eq(conversations.id, conversationId),
		columns: { id: true, createdAt: true, firstResponseAt: true },
	});
	if (!conv || conv.firstResponseAt) return;

	const at = message.createdAt ?? new Date();
	const sec = Math.max(
		0,
		Math.floor((at.getTime() - conv.createdAt.getTime()) / 1000),
	);

	await db
		.update(conversations)
		.set({
			firstResponseAt: at,
			firstResponseSec: sec,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(conversations.id, conversationId),
				isNull(conversations.firstResponseAt),
			),
		);
}

export async function recordResolvedIfNeeded(
	conversationId: string,
	status: string,
): Promise<void> {
	if (status !== "resolved" && status !== "closed") return;

	const now = new Date();
	await db
		.update(conversations)
		.set({
			resolvedAt: now,
			...(status === "closed" ? { closedAt: now } : {}),
			updatedAt: now,
		})
		.where(
			and(
				eq(conversations.id, conversationId),
				isNull(conversations.resolvedAt),
			),
		);
}
