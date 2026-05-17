import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { ipBanned } from "./errors.js";
import { isIpBanned, parseBannedIps } from "./ip-ban.js";
import { clientIp } from "./visitor-context.js";

export async function assertWorkspaceIpAllowed(
	request: FastifyRequest,
	workspaceId: string,
): Promise<void> {
	const ip = clientIp(request);
	if (!ip) return;

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	if (!ws) return;

	if (isIpBanned(ip, parseBannedIps(ws.settings))) {
		throw ipBanned();
	}
}
