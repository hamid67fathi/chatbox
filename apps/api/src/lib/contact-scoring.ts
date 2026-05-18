import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { contactScores, contacts, scoringRules } from "../db/schema/index.js";

export async function recomputeContactScore(
	workspaceId: string,
	contactId: string,
): Promise<{ score: number; breakdown: Record<string, unknown> }> {
	const rules = await db.query.scoringRules.findMany({
		where: eq(scoringRules.workspaceId, workspaceId),
	});
	const contact = await db.query.contacts.findFirst({
		where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
	});
	if (!contact) return { score: 0, breakdown: {} };

	const breakdown: Record<string, number> = {};
	let score = 0;

	for (const rule of rules) {
		let points = 0;
		switch (rule.signalType) {
			case "lifecycle_vip":
				if (contact.lifecycleStage === "vip") points = rule.weight;
				break;
			case "lifecycle_customer":
				if (contact.lifecycleStage === "customer") points = rule.weight;
				break;
			case "has_email":
				if (contact.email) points = rule.weight;
				break;
			case "has_phone":
				if (contact.phone) points = rule.weight;
				break;
			default:
				points = 0;
		}
		if (points > 0) breakdown[rule.signalType] = points;
		score += points;
	}

	score = Math.min(100, Math.max(0, score));

	await db
		.insert(contactScores)
		.values({
			contactId,
			workspaceId,
			score,
			breakdown,
			computedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: contactScores.contactId,
			set: { score, breakdown, computedAt: new Date() },
		});

	return { score, breakdown };
}

export async function ensureDefaultScoringRules(workspaceId: string) {
	const existing = await db.query.scoringRules.findFirst({
		where: eq(scoringRules.workspaceId, workspaceId),
	});
	if (existing) return;
	await db.insert(scoringRules).values([
		{ workspaceId, signalType: "has_email", weight: 15 },
		{ workspaceId, signalType: "has_phone", weight: 10 },
		{ workspaceId, signalType: "lifecycle_customer", weight: 25 },
		{ workspaceId, signalType: "lifecycle_vip", weight: 40 },
	]);
}
