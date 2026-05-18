import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";

function parseTrackingKey(settings: unknown): string | null {
	if (!settings || typeof settings !== "object") return null;
	const tracking = (settings as { tracking?: unknown }).tracking;
	if (!tracking || typeof tracking !== "object") return null;
	const key = (tracking as { public_key?: unknown }).public_key;
	return typeof key === "string" && key.length >= 16 ? key : null;
}

export async function ensureTrackingPublicKey(
	workspaceId: string,
): Promise<string> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
	});
	if (!ws) throw new Error("Workspace not found.");

	const existing = parseTrackingKey(ws.settings);
	if (existing) return existing;

	const publicKey = randomBytes(24).toString("hex");
	const base =
		ws.settings && typeof ws.settings === "object"
			? { ...(ws.settings as Record<string, unknown>) }
			: {};
	const tracking =
		base.tracking && typeof base.tracking === "object"
			? { ...(base.tracking as Record<string, unknown>) }
			: {};
	tracking.public_key = publicKey;
	base.tracking = tracking;

	await db
		.update(workspaces)
		.set({ settings: base, updatedAt: new Date() })
		.where(eq(workspaces.id, workspaceId));

	return publicKey;
}

export async function resolveWorkspaceByTrackingKey(
	workspaceKey: string,
): Promise<{ id: string; plan: string } | null> {
	const key = workspaceKey.trim();
	if (!key) return null;

	const [ws] = await db
		.select({ id: workspaces.id, plan: workspaces.plan })
		.from(workspaces)
		.where(sql`${workspaces.settings}->'tracking'->>'public_key' = ${key}`)
		.limit(1);

	return ws ?? null;
}
