import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaceMembers } from "../db/schema/index.js";
import { validationError } from "../lib/errors.js";
import { mergeNotificationPreferences } from "../lib/notification-preferences.js";

export async function notificationRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: {
			workspace_id?: string;
			user_id?: string;
			token?: string;
		};
	}>(
		"/v1/notifications/unsubscribe",
		async (request, reply) => {
			const workspaceId = request.query.workspace_id?.trim();
			const userId = request.query.user_id?.trim();
			const token = request.query.token?.trim();
			if (!workspaceId || !userId || !token) {
				throw validationError(
					"workspace_id, user_id, and token are required.",
				);
			}

			const row = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.userId, userId),
				),
			});
			if (!row) {
				return reply.type("text/html; charset=utf-8").send(
					`<html dir="rtl" lang="fa"><body style="font-family:Tahoma;padding:24px"><p>لینک نامعتبر است.</p></body></html>`,
				);
			}

			const prefs = mergeNotificationPreferences(row.notificationPreferences, {
				email_enabled: false,
			});
			if (prefs.email_unsubscribe_token !== token) {
				return reply.type("text/html; charset=utf-8").send(
					`<html dir="rtl" lang="fa"><body style="font-family:Tahoma;padding:24px"><p>لینک نامعتبر یا منقضی شده است.</p></body></html>`,
				);
			}

			await db
				.update(workspaceMembers)
				.set({ notificationPreferences: prefs })
				.where(
					and(
						eq(workspaceMembers.workspaceId, workspaceId),
						eq(workspaceMembers.userId, userId),
					),
				);

			return reply.type("text/html; charset=utf-8").send(
				`<html dir="rtl" lang="fa"><body style="font-family:Tahoma;padding:24px;direction:rtl"><h1>اشتراک ایمیل لغو شد</h1><p>دیگر اعلان ایمیل دریافت نخواهید کرد. می‌توانید از تنظیمات داشبورد دوباره فعال کنید.</p></body></html>`,
			);
		},
	);
}
