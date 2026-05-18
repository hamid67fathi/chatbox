import type { FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema/index.js";

export const AUDIT_ACTIONS = {
	AUTH_LOGIN: "auth.login",
	AUTH_LOGOUT: "auth.logout",
	AUTH_LOGIN_GOOGLE: "auth.login_google",
	AUTH_2FA_ENABLE: "auth.2fa_enable",
	AUTH_2FA_DISABLE: "auth.2fa_disable",
	SECURITY_REQUIRE_2FA: "security.require_2fa_update",
	WORKSPACE_UPDATE: "workspace.update",
	WIDGET_CONFIG_UPDATE: "widget_config.update",
	BRANDING_UPDATE: "branding.update",
	SECURITY_BANNED_IPS: "security.banned_ips_update",
	SECURITY_DASHBOARD_IP_WHITELIST: "security.dashboard_ip_whitelist_update",
	NOTIFICATION_PREFS: "notification.preferences_update",
	API_TOKEN_CREATE: "api_token.create",
	API_TOKEN_REVOKE: "api_token.revoke",
	EXPORT_CONTACTS: "data.export_contacts",
	EXPORT_CONVERSATIONS: "data.export_conversations",
	EXPORT_AGENTS: "data.export_agents",
	EXPORT_OVERVIEW: "data.export_overview",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditLogEntry {
	workspaceId?: string | null;
	actorUserId: string;
	action: string;
	targetType?: string | null;
	targetId?: string | null;
	diff?: Record<string, unknown> | null;
	ip?: string | null;
	userAgent?: string | null;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
	try {
		await db.insert(auditLogs).values({
			workspaceId: entry.workspaceId ?? null,
			actorUserId: entry.actorUserId,
			action: entry.action,
			targetType: entry.targetType ?? null,
			targetId: entry.targetId ?? null,
			diff: entry.diff ?? null,
			ipAddress: entry.ip ?? null,
			userAgent: entry.userAgent ?? null,
		});
	} catch (err) {
		console.error("[audit-log] write failed:", err);
	}
}

export function auditLogFromRequest(
	request: FastifyRequest,
	entry: Omit<AuditLogEntry, "ip" | "userAgent">,
): void {
	void writeAuditLog({
		...entry,
		ip: request.ip ?? null,
		userAgent:
			typeof request.headers["user-agent"] === "string"
				? request.headers["user-agent"]
				: null,
	});
}
