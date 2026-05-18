import {
	templateAssigned,
	templateMention,
	templateNewConversation,
} from "@chatbox/mailer";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, workspaceMembers } from "../../db/schema/index.js";
import {
	ensureUnsubscribeToken,
	parseNotificationPreferences,
} from "../notification-preferences.js";
import { enqueueEmailNotification } from "./queue.js";

const DASHBOARD_URL =
	process.env.DASHBOARD_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const API_PUBLIC_URL =
	process.env.API_PUBLIC_URL?.replace(/\/$/, "") ??
	`http://localhost:${process.env.PORT ?? 3001}`;

function inboxUrl(conversationId: string): string {
	return `${DASHBOARD_URL}/?conversation=${conversationId}`;
}

function unsubscribeUrl(
	workspaceId: string,
	userId: string,
	token: string,
): string {
	return `${API_PUBLIC_URL}/v1/notifications/unsubscribe?workspace_id=${encodeURIComponent(workspaceId)}&user_id=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

async function activeAgents(workspaceId: string) {
	return db
		.select({
			userId: workspaceMembers.userId,
			email: users.email,
			fullName: users.fullName,
			notificationPreferences: workspaceMembers.notificationPreferences,
		})
		.from(workspaceMembers)
		.innerJoin(users, eq(workspaceMembers.userId, users.id))
		.where(
			and(
				eq(workspaceMembers.workspaceId, workspaceId),
				eq(workspaceMembers.status, "active"),
				inArray(workspaceMembers.role, ["owner", "admin", "agent"]),
			),
		);
}

async function memberPrefs(workspaceId: string, userId: string) {
	const row = await db.query.workspaceMembers.findFirst({
		where: and(
			eq(workspaceMembers.workspaceId, workspaceId),
			eq(workspaceMembers.userId, userId),
		),
	});
	if (!row) return null;
	return parseNotificationPreferences(row.notificationPreferences);
}

async function queueForUser(
	workspaceId: string,
	userId: string,
	toEmail: string | null | undefined,
	kind: "new_conversation" | "assigned" | "mention",
	build: (unsub: string) => { subject: string; html: string; text: string },
) {
	if (!toEmail?.trim()) return;
	let prefs = await memberPrefs(workspaceId, userId);
	if (!prefs) return;
	prefs = ensureUnsubscribeToken(prefs);
	if (!prefs.email_enabled) return;

	const flag =
		kind === "new_conversation"
			? prefs.email_new_conversation
			: kind === "assigned"
				? prefs.email_assigned
				: prefs.email_mention;
	if (!flag) return;

	const beforeToken = prefs.email_unsubscribe_token;
	prefs = ensureUnsubscribeToken(prefs);
	if (!beforeToken && prefs.email_unsubscribe_token) {
		await db
			.update(workspaceMembers)
			.set({ notificationPreferences: prefs })
			.where(
				and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.userId, userId),
				),
			);
	}

	const unsub = unsubscribeUrl(
		workspaceId,
		userId,
		prefs.email_unsubscribe_token!,
	);
	const { subject, html, text } = build(unsub);

	await enqueueEmailNotification({
		workspaceId,
		userId,
		toEmail: toEmail.trim(),
		kind,
		subject,
		html,
		text,
	});
}

export async function emailNotifyNewConversation(
	workspaceId: string,
	conversationId: string,
	contactName: string | null,
	channel: string,
) {
	const agents = await activeAgents(workspaceId);
	const url = inboxUrl(conversationId);
	for (const a of agents) {
		await queueForUser(
			workspaceId,
			a.userId,
			a.email,
			"new_conversation",
			(unsub) => {
				const t = templateNewConversation(
					contactName ?? "مشتری",
					channel,
					url,
					unsub,
				);
				return {
					subject: "مکالمه جدید — ChatBox",
					...t,
				};
			},
		);
	}
}

export async function emailNotifyAssigned(
	workspaceId: string,
	conversationId: string,
	agentUserId: string,
	contactName: string | null,
) {
	const user = await db.query.users.findFirst({
		where: eq(users.id, agentUserId),
		columns: { email: true },
	});
	const url = inboxUrl(conversationId);
	await queueForUser(
		workspaceId,
		agentUserId,
		user?.email,
		"assigned",
		(unsub) => {
			const t = templateAssigned(contactName ?? "مشتری", url, unsub);
			return { subject: "مکالمه به شما اختصاص یافت — ChatBox", ...t };
		},
	);
}

export async function emailNotifyMention(
	workspaceId: string,
	conversationId: string,
	mentionedUserId: string,
	authorName: string,
	noteBody: string,
) {
	const user = await db.query.users.findFirst({
		where: eq(users.id, mentionedUserId),
		columns: { email: true },
	});
	const preview =
		noteBody.length > 200 ? `${noteBody.slice(0, 200)}…` : noteBody;
	const url = inboxUrl(conversationId);
	await queueForUser(
		workspaceId,
		mentionedUserId,
		user?.email,
		"mention",
		(unsub) => {
			const t = templateMention(authorName, preview, url, unsub);
			return { subject: "اشاره در یادداشت — ChatBox", ...t };
		},
	);
}

const UUID_RE =
	/@([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;
const EMAIL_RE = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export async function emailNotifyNoteMentions(
	workspaceId: string,
	conversationId: string,
	authorUserId: string,
	noteBody: string,
) {
	const author = await db.query.users.findFirst({
		where: eq(users.id, authorUserId),
		columns: { fullName: true, email: true },
	});
	const authorName =
		author?.fullName ?? author?.email ?? "عضو تیم";

	const agents = await activeAgents(workspaceId);
	const mentioned = new Set<string>();

	let m: RegExpExecArray | null;
	UUID_RE.lastIndex = 0;
	while ((m = UUID_RE.exec(noteBody)) !== null) {
		if (m[1] && m[1] !== authorUserId) mentioned.add(m[1]);
	}

	const emails = new Set<string>();
	EMAIL_RE.lastIndex = 0;
	while ((m = EMAIL_RE.exec(noteBody)) !== null) {
		if (m[1]) emails.add(m[1].toLowerCase());
	}

	for (const a of agents) {
		if (a.userId === authorUserId) continue;
		if (mentioned.has(a.userId)) continue;
		if (a.email && emails.has(a.email.toLowerCase())) {
			mentioned.add(a.userId);
		}
	}

	for (const userId of mentioned) {
		await emailNotifyMention(
			workspaceId,
			conversationId,
			userId,
			authorName,
			noteBody,
		);
	}
}
