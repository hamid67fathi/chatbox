import { templateSuspiciousLogin } from "@chatbox/mailer";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, workspaceMembers, workspaces } from "../db/schema/index.js";
import { enqueueEmailNotification } from "./email-notifications/queue.js";
import { isIpAllowedByRules, parseDashboardIpWhitelist } from "./ip-ban.js";

const DASHBOARD_URL =
	process.env.DASHBOARD_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/** Notify workspace supervisors when a member logs in from outside the dashboard IP whitelist. */
export async function notifySuspiciousDashboardLogin(
	userId: string,
	clientIp: string | null,
): Promise<void> {
	if (!clientIp) return;

	const memberships = await db
		.select({ workspaceId: workspaceMembers.workspaceId })
		.from(workspaceMembers)
		.where(
			and(
				eq(workspaceMembers.userId, userId),
				eq(workspaceMembers.status, "active"),
			),
		);

	if (memberships.length === 0) return;

	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { email: true, fullName: true },
	});
	const userLabel = user?.fullName ?? user?.email ?? userId;

	for (const { workspaceId } of memberships) {
		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, workspaceId),
			columns: { settings: true, name: true },
		});
		if (!ws) continue;

		const whitelist = parseDashboardIpWhitelist(ws.settings);
		if (whitelist.length === 0) continue;
		if (isIpAllowedByRules(clientIp, whitelist)) continue;

		const supervisors = await db
			.select({
				userId: workspaceMembers.userId,
				email: users.email,
			})
			.from(workspaceMembers)
			.innerJoin(users, eq(workspaceMembers.userId, users.id))
			.where(
				and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.status, "active"),
					inArray(workspaceMembers.role, ["owner", "admin"]),
				),
			);

		const settingsUrl = `${DASHBOARD_URL}/settings`;
		const t = templateSuspiciousLogin(userLabel, clientIp, settingsUrl);

		for (const sup of supervisors) {
			if (!sup.email?.trim()) continue;
			await enqueueEmailNotification({
				workspaceId,
				userId: sup.userId,
				toEmail: sup.email.trim(),
				kind: "suspicious_login",
				subject: `ورود مشکوک — ${ws.name ?? "ChatBox"}`,
				html: t.html,
				text: t.text,
			});
		}
	}
}
