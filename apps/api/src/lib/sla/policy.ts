import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { slaPolicies, workspaces } from "../../db/schema/index.js";
import { defaultSlaPolicyForPlan } from "./compute.js";
import type { SlaPolicyConfig } from "./types.js";

export async function getSlaPolicyForWorkspace(
	workspaceId: string,
): Promise<SlaPolicyConfig> {
	const row = await db.query.slaPolicies.findFirst({
		where: eq(slaPolicies.workspaceId, workspaceId),
	});
	if (row) {
		return {
			enabled: row.enabled,
			first_response_minutes: row.firstResponseMinutes,
			resolution_minutes: row.resolutionMinutes,
			warn_at_percent: row.warnAtPercent,
		};
	}

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { plan: true },
	});
	return defaultSlaPolicyForPlan(ws?.plan ?? "free");
}

export async function upsertSlaPolicy(
	workspaceId: string,
	patch: Partial<SlaPolicyConfig>,
): Promise<SlaPolicyConfig> {
	const current = await getSlaPolicyForWorkspace(workspaceId);
	const next: SlaPolicyConfig = {
		enabled: patch.enabled ?? current.enabled,
		first_response_minutes:
			patch.first_response_minutes ?? current.first_response_minutes,
		resolution_minutes:
			patch.resolution_minutes ?? current.resolution_minutes,
		warn_at_percent: patch.warn_at_percent ?? current.warn_at_percent,
	};

	const existing = await db.query.slaPolicies.findFirst({
		where: eq(slaPolicies.workspaceId, workspaceId),
	});

	if (existing) {
		await db
			.update(slaPolicies)
			.set({
				enabled: next.enabled,
				firstResponseMinutes: next.first_response_minutes,
				resolutionMinutes: next.resolution_minutes,
				warnAtPercent: next.warn_at_percent,
				updatedAt: new Date(),
			})
			.where(eq(slaPolicies.workspaceId, workspaceId));
	} else {
		await db.insert(slaPolicies).values({
			workspaceId,
			enabled: next.enabled,
			firstResponseMinutes: next.first_response_minutes,
			resolutionMinutes: next.resolution_minutes,
			warnAtPercent: next.warn_at_percent,
		});
	}

	return next;
}
