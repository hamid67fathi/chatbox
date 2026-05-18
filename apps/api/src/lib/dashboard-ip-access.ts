import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { forbidden } from "./auth.js";
import { isIpAllowedByRules, parseDashboardIpWhitelist } from "./ip-ban.js";

export function clientIpFromRequest(request: FastifyRequest): string | null {
	const ip = request.ip?.trim();
	return ip && ip.length > 0 ? ip : null;
}

export async function assertDashboardIpAllowed(
	workspaceId: string,
	clientIp: string | null,
): Promise<void> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	if (!ws) return;

	const whitelist = parseDashboardIpWhitelist(ws.settings);
	if (whitelist.length === 0) return;

	if (!isIpAllowedByRules(clientIp, whitelist)) {
		throw forbidden(
			"Access from this IP is not allowed for this workspace dashboard.",
		);
	}
}
