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
	normalizeBanRule,
	parseBannedIps,
} from "../lib/ip-ban.js";
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

		return { data: parseBannedIps(updated?.settings) };
	});
}
