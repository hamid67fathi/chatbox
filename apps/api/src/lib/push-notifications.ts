import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "../db/index.js";
import {
	pushSubscriptions,
	workspaceMembers,
} from "../db/schema/index.js";
import {
	parseNotificationPreferences,
	type NotificationPreferences,
} from "./notification-preferences.js";

export interface PushPayload {
	title: string;
	body: string;
	url?: string;
	tag?: string;
}

let vapidReady = false;

function initVapid() {
	if (vapidReady) return true;
	const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
	const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
	const subject =
		process.env.VAPID_SUBJECT?.trim() ?? "mailto:support@chatbox.local";
	if (!publicKey || !privateKey) return false;
	webpush.setVapidDetails(subject, publicKey, privateKey);
	vapidReady = true;
	return true;
}

export function getVapidPublicKey(): string | null {
	return process.env.VAPID_PUBLIC_KEY?.trim() ?? null;
}

export function isPushConfigured(): boolean {
	return Boolean(
		process.env.VAPID_PUBLIC_KEY?.trim() &&
			process.env.VAPID_PRIVATE_KEY?.trim(),
	);
}

async function sendToSubscription(
	sub: { endpoint: string; p256dh: string; auth: string },
	payload: PushPayload,
) {
	if (!initVapid()) return;
	const body = JSON.stringify(payload);
	await webpush.sendNotification(
		{
			endpoint: sub.endpoint,
			keys: { p256dh: sub.p256dh, auth: sub.auth },
		},
		body,
	);
}

async function loadMemberPrefs(
	workspaceId: string,
	userId: string,
): Promise<NotificationPreferences | null> {
	const row = await db.query.workspaceMembers.findFirst({
		where: and(
			eq(workspaceMembers.workspaceId, workspaceId),
			eq(workspaceMembers.userId, userId),
			eq(workspaceMembers.status, "active"),
		),
		columns: { notificationPreferences: true },
	});
	if (!row) return null;
	return parseNotificationPreferences(row.notificationPreferences);
}

async function notifyUsers(
	workspaceId: string,
	userIds: string[],
	payload: PushPayload,
	prefKey: keyof NotificationPreferences,
) {
	if (!userIds.length || !isPushConfigured()) return;

	const uniqueIds = [...new Set(userIds)];
	const subs = await db.query.pushSubscriptions.findMany({
		where: and(
			eq(pushSubscriptions.workspaceId, workspaceId),
			inArray(pushSubscriptions.userId, uniqueIds),
		),
	});

	for (const sub of subs) {
		const prefs = await loadMemberPrefs(workspaceId, sub.userId);
		if (!prefs?.push_enabled || !prefs[prefKey]) continue;
		try {
			await sendToSubscription(sub, payload);
		} catch (err) {
			const status = (err as { statusCode?: number }).statusCode;
			if (status === 404 || status === 410) {
				await db
					.delete(pushSubscriptions)
					.where(eq(pushSubscriptions.id, sub.id));
			}
		}
	}
}

async function activeAgentUserIds(workspaceId: string): Promise<string[]> {
	const rows = await db
		.select({ userId: workspaceMembers.userId })
		.from(workspaceMembers)
		.where(
			and(
				eq(workspaceMembers.workspaceId, workspaceId),
				eq(workspaceMembers.status, "active"),
				inArray(workspaceMembers.role, ["owner", "admin", "agent"]),
			),
		);
	return rows.map((r) => r.userId);
}

export async function notifyNewConversation(
	workspaceId: string,
	conversationId: string,
	contactName: string | null,
	channel: string,
) {
	const userIds = await activeAgentUserIds(workspaceId);
	await notifyUsers(
		workspaceId,
		userIds,
		{
			title: "مکالمه جدید",
			body: contactName
				? `${contactName} · ${channel}`
				: `مکالمه جدید از ${channel}`,
			url: `/?conversation=${conversationId}`,
			tag: `conv-${conversationId}`,
		},
		"new_conversation",
	);
}

export async function notifyNewContactMessage(
	workspaceId: string,
	conversationId: string,
	assignedAgentId: string | null,
	contactName: string | null,
	preview: string,
) {
	const userIds = assignedAgentId
		? [assignedAgentId]
		: await activeAgentUserIds(workspaceId);

	const body =
		preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;

	await notifyUsers(
		workspaceId,
		userIds,
		{
			title: contactName ? `پیام از ${contactName}` : "پیام جدید",
			body,
			url: `/?conversation=${conversationId}`,
			tag: `msg-${conversationId}`,
		},
		"new_message",
	);
}
