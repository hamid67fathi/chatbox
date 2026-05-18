import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { conversations, slaPolicies } from "../../db/schema/index.js";
import { computeSlaStatus } from "./compute.js";
import { getSlaPolicyForWorkspace } from "./policy.js";

/** Periodic SLA check — emits workspace events for newly breached conversations. */
export async function runSlaMonitorTick(): Promise<void> {
	const policies = await db.query.slaPolicies.findMany({
		where: eq(slaPolicies.enabled, true),
		columns: { workspaceId: true },
	});

	const workspaceIds = policies.map((p) => p.workspaceId);
	if (workspaceIds.length === 0) return;

	const openConvs = await db.query.conversations.findMany({
		where: and(
			inArray(conversations.workspaceId, workspaceIds),
			inArray(conversations.status, ["open", "pending"]),
		),
		columns: {
			id: true,
			workspaceId: true,
			createdAt: true,
			firstResponseAt: true,
			firstResponseSec: true,
			resolvedAt: true,
			closedAt: true,
			status: true,
			metadata: true,
		},
		limit: 500,
	});

	const policyCache = new Map<string, Awaited<ReturnType<typeof getSlaPolicyForWorkspace>>>();

	try {
		const { getIO } = await import("../../ws/broadcast.js");
		const io = getIO();

		for (const conv of openConvs) {
			let policy = policyCache.get(conv.workspaceId);
			if (!policy) {
				policy = await getSlaPolicyForWorkspace(conv.workspaceId);
				policyCache.set(conv.workspaceId, policy);
			}

			const sla = computeSlaStatus(conv, policy);
			const breached =
				sla.first_response === "breached" || sla.resolution === "breached";
			if (!breached) continue;

			const meta =
				conv.metadata && typeof conv.metadata === "object"
					? { ...(conv.metadata as Record<string, unknown>) }
					: {};
			if (meta.sla_breach_notified === true) continue;

			io.to(`workspace:${conv.workspaceId}`).emit("sla:breach", {
				conversation_id: conv.id,
				sla,
			});

			meta.sla_breach_notified = true;
			await db
				.update(conversations)
				.set({ metadata: meta, updatedAt: new Date() })
				.where(eq(conversations.id, conv.id));
		}
	} catch {
		/* socket not ready */
	}
}
