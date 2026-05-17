import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions } from "../db/schema/index.js";

/** Paid subscription removes widget trademark footer. */
export async function shouldShowWidgetBranding(
	workspaceId: string,
): Promise<boolean> {
	const sub = await db.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.workspaceId, workspaceId),
			eq(subscriptions.status, "active"),
		),
		orderBy: [desc(subscriptions.createdAt)],
	});
	return !sub;
}

export const DEFAULT_WIDGET_BRANDING = {
	label: "قدرت گرفته از ChatBox",
	url: process.env.WIDGET_BRANDING_URL ?? "https://github.com/hamid67fathi/chatbox",
};
