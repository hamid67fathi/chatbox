import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { pushSubscriptions, workspaceMembers } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { notFound, validationError } from "../lib/errors.js";
import {
	mergeNotificationPreferences,
	parseNotificationPreferences,
} from "../lib/notification-preferences.js";
import { getVapidPublicKey, isPushConfigured } from "../lib/push-notifications.js";
import { requireWorkspace } from "../lib/rbac.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function pushRoutes(app: FastifyInstance) {
	app.get("/v1/push/vapid-public-key", async () => {
		const publicKey = getVapidPublicKey();
		return {
			data: {
				public_key: publicKey,
				configured: isPushConfigured(),
			},
		};
	});

	app.get(
		"/v1/notification-preferences",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const row = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(workspaceMembers.workspaceId, wsId),
					eq(workspaceMembers.userId, user.id),
				),
			});
			if (!row) throw notFound("Workspace membership not found.");
			return {
				data: parseNotificationPreferences(row.notificationPreferences),
			};
		},
	);

	app.patch<{
		Body: {
			push_enabled?: boolean;
			new_conversation?: boolean;
			new_message?: boolean;
			email_enabled?: boolean;
			email_new_conversation?: boolean;
			email_assigned?: boolean;
			email_mention?: boolean;
		};
	}>(
		"/v1/notification-preferences",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const body = request.body ?? {};
			const row = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(workspaceMembers.workspaceId, wsId),
					eq(workspaceMembers.userId, user.id),
				),
			});
			if (!row) throw notFound("Workspace membership not found.");

			const merged = mergeNotificationPreferences(
				row.notificationPreferences,
				{
					...(typeof body.push_enabled === "boolean"
						? { push_enabled: body.push_enabled }
						: {}),
					...(typeof body.new_conversation === "boolean"
						? { new_conversation: body.new_conversation }
						: {}),
					...(typeof body.new_message === "boolean"
						? { new_message: body.new_message }
						: {}),
					...(typeof body.email_enabled === "boolean"
						? { email_enabled: body.email_enabled }
						: {}),
					...(typeof body.email_new_conversation === "boolean"
						? { email_new_conversation: body.email_new_conversation }
						: {}),
					...(typeof body.email_assigned === "boolean"
						? { email_assigned: body.email_assigned }
						: {}),
					...(typeof body.email_mention === "boolean"
						? { email_mention: body.email_mention }
						: {}),
				},
			);

			await db
				.update(workspaceMembers)
				.set({ notificationPreferences: merged })
				.where(
					and(
						eq(workspaceMembers.workspaceId, wsId),
						eq(workspaceMembers.userId, user.id),
					),
				);

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.NOTIFICATION_PREFS,
				targetType: "workspace_member",
				targetId: user.id,
			});

			return { data: merged };
		},
	);

	app.post<{
		Body: {
			endpoint?: string;
			keys?: { p256dh?: string; auth?: string };
		};
	}>(
		"/v1/push/subscribe",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request, reply) => {
			if (!isPushConfigured()) {
				throw validationError(
					"Push notifications are not configured on the server.",
					"push",
				);
			}
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const endpoint = request.body?.endpoint?.trim();
			const p256dh = request.body?.keys?.p256dh?.trim();
			const auth = request.body?.keys?.auth?.trim();
			if (!endpoint || !p256dh || !auth) {
				throw validationError("Invalid push subscription.", "subscription");
			}

			const ua =
				typeof request.headers["user-agent"] === "string"
					? request.headers["user-agent"]
					: null;

			await db
				.insert(pushSubscriptions)
				.values({
					userId: user.id,
					workspaceId: wsId,
					endpoint,
					p256dh,
					auth,
					userAgent: ua,
				})
				.onConflictDoUpdate({
					target: pushSubscriptions.endpoint,
					set: {
						userId: user.id,
						workspaceId: wsId,
						p256dh,
						auth,
						userAgent: ua,
						updatedAt: new Date(),
					},
				});

			return reply.status(201).send({ data: { subscribed: true } });
		},
	);

	app.delete<{ Body: { endpoint?: string } }>(
		"/v1/push/subscribe",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request, reply) => {
			const user = (request as AuthenticatedRequest).user;
			const endpoint = request.body?.endpoint?.trim();
			if (!endpoint) {
				throw validationError("endpoint is required.", "endpoint");
			}
			await db
				.delete(pushSubscriptions)
				.where(
					and(
						eq(pushSubscriptions.endpoint, endpoint),
						eq(pushSubscriptions.userId, user.id),
					),
				);
			return reply.status(204).send();
		},
	);
}
