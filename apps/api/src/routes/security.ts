import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { forbidden } from "../lib/auth.js";
import {
	getWorkspaceRole,
	isSupervisorRole,
} from "../lib/conversation-access.js";
import { notFound, validationError } from "../lib/errors.js";
import {
	mergeBannedIpsSettings,
	mergeDashboardIpWhitelist,
	normalizeBanRule,
	parseBannedIps,
	parseDashboardIpWhitelist,
} from "../lib/ip-ban.js";
import {
	mergeRequire2faSettings,
	parseRequire2fa,
} from "../lib/workspace-2fa-policy.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function securityRoutes(app: FastifyInstance) {
	app.get("/v1/security/banned-ips", async (request) => {
		const wsId = getWorkspaceId(request);
		const user = (request as AuthenticatedRequest).user;
		const role = await getWorkspaceRole(wsId, user.id);
		if (!role || !isSupervisorRole(role)) {
			throw forbidden("Only workspace admins can view banned IPs.");
		}

		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, wsId),
		});
		if (!ws) throw notFound("Workspace not found.");

		return { data: parseBannedIps(ws.settings) };
	});

	app.put<{ Body: { ips?: string[] } }>("/v1/security/banned-ips", async (request) => {
		const wsId = getWorkspaceId(request);
		const user = (request as AuthenticatedRequest).user;
		const role = await getWorkspaceRole(wsId, user.id);
		if (!role || !isSupervisorRole(role)) {
			throw forbidden("Only workspace admins can update banned IPs.");
		}

		const raw = request.body?.ips;
		if (!Array.isArray(raw)) {
			throw validationError("ips must be an array of strings.", "ips");
		}

		const normalized: string[] = [];
		for (const item of raw) {
			if (typeof item !== "string") continue;
			const rule = normalizeBanRule(item);
			if (!rule) {
				throw validationError(
					`Invalid IP or range: ${item}. Use IPv4, wildcard (e.g. 192.168.1.*), or CIDR.`,
					"ips",
				);
			}
			normalized.push(rule);
		}

		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, wsId),
		});
		if (!ws) throw notFound("Workspace not found.");

		const [updated] = await db
			.update(workspaces)
			.set({
				settings: mergeBannedIpsSettings(ws.settings, normalized),
				updatedAt: new Date(),
			})
			.where(eq(workspaces.id, wsId))
			.returning();

		auditLogFromRequest(request, {
			workspaceId: wsId,
			actorUserId: user.id,
			action: AUDIT_ACTIONS.SECURITY_BANNED_IPS,
			targetType: "workspace",
			targetId: wsId,
			diff: { count: normalized.length },
		});

		return { data: parseBannedIps(updated?.settings) };
	});

	app.get("/v1/security/dashboard-ip-whitelist", async (request) => {
		const wsId = getWorkspaceId(request);
		const user = (request as AuthenticatedRequest).user;
		const role = await getWorkspaceRole(wsId, user.id);
		if (!role || !isSupervisorRole(role)) {
			throw forbidden("Only workspace admins can view dashboard IP whitelist.");
		}

		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, wsId),
		});
		if (!ws) throw notFound("Workspace not found.");

		return { data: parseDashboardIpWhitelist(ws.settings) };
	});

	app.put<{ Body: { ips?: string[] } }>(
		"/v1/security/dashboard-ip-whitelist",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const role = await getWorkspaceRole(wsId, user.id);
			if (!role || !isSupervisorRole(role)) {
				throw forbidden(
					"Only workspace admins can update dashboard IP whitelist.",
				);
			}

			const raw = request.body?.ips;
			if (!Array.isArray(raw)) {
				throw validationError("ips must be an array of strings.", "ips");
			}

			const normalized: string[] = [];
			for (const item of raw) {
				if (typeof item !== "string") continue;
				const rule = normalizeBanRule(item);
				if (!rule) {
					throw validationError(
						`Invalid IP or range: ${item}. Use IPv4, wildcard (e.g. 192.168.1.*), or CIDR.`,
						"ips",
					);
				}
				normalized.push(rule);
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const merged = mergeDashboardIpWhitelist(ws.settings, normalized);
			const [updated] = await db
				.update(workspaces)
				.set({ settings: merged, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId))
				.returning();

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.SECURITY_DASHBOARD_IP_WHITELIST,
				targetType: "workspace",
				targetId: wsId,
				diff: { count: normalized.length, enabled: normalized.length > 0 },
			});

			return { data: parseDashboardIpWhitelist(updated?.settings) };
		},
	);

	app.get("/v1/security/require-2fa", async (request) => {
		const wsId = getWorkspaceId(request);
		const user = (request as AuthenticatedRequest).user;
		const role = await getWorkspaceRole(wsId, user.id);
		if (!role || !isSupervisorRole(role)) {
			throw forbidden("Only workspace admins can view 2FA policy.");
		}

		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, wsId),
		});
		if (!ws) throw notFound("Workspace not found.");

		return { data: { enabled: parseRequire2fa(ws.settings) } };
	});

	app.put<{ Body: { enabled?: boolean } }>(
		"/v1/security/require-2fa",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const role = await getWorkspaceRole(wsId, user.id);
			if (role !== "owner") {
				throw forbidden("Only the workspace owner can require 2FA.");
			}

			if (typeof request.body?.enabled !== "boolean") {
				throw validationError("enabled must be a boolean.", "enabled");
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const merged = mergeRequire2faSettings(ws.settings, request.body.enabled);
			const [updated] = await db
				.update(workspaces)
				.set({ settings: merged, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId))
				.returning();

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.SECURITY_REQUIRE_2FA,
				targetType: "workspace",
				targetId: wsId,
				diff: { enabled: request.body.enabled },
			});

			return { data: { enabled: parseRequire2fa(updated?.settings) } };
		},
	);
}
