import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { contactHealth, contacts, conversations } from "../db/schema/index.js";

const AT_RISK_STAGES = ["customer", "vip", "at_risk"];

export async function recomputeContactHealth(
	workspaceId: string,
	contactId: string,
): Promise<{
	score: number;
	risk_level: "low" | "medium" | "high";
	signals: Record<string, unknown>;
}> {
	const contact = await db.query.contacts.findFirst({
		where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)),
	});
	if (!contact) {
		return { score: 50, risk_level: "low", signals: {} };
	}

	const lastConv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.workspaceId, workspaceId),
			eq(conversations.contactId, contactId),
		),
		orderBy: [desc(conversations.lastMessageAt)],
	});

	const daysSince =
		lastConv?.lastMessageAt != null
			? Math.floor(
					(Date.now() - lastConv.lastMessageAt.getTime()) / (24 * 60 * 60 * 1000),
				)
			: 999;

	let score = 80;
	if (daysSince > 60) score = 20;
	else if (daysSince > 30) score = 40;
	else if (daysSince > 14) score = 60;

	if (contact.lifecycleStage === "at_risk" || contact.lifecycleStage === "churned") {
		score = Math.min(score, 25);
	}

	let risk_level: "low" | "medium" | "high" = "low";
	if (score < 35) risk_level = "high";
	else if (score < 60) risk_level = "medium";

	const signals = {
		days_since_last_message: daysSince,
		lifecycle_stage: contact.lifecycleStage,
	};

	await db
		.insert(contactHealth)
		.values({
			contactId,
			workspaceId,
			score,
			riskLevel: risk_level,
			signals,
			computedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: contactHealth.contactId,
			set: {
				score,
				riskLevel: risk_level,
				signals,
				computedAt: new Date(),
			},
		});

	return { score, risk_level, signals };
}

export async function listAtRiskContacts(workspaceId: string, limit = 50) {
	const rows = await db.query.contacts.findMany({
		where: and(
			eq(contacts.workspaceId, workspaceId),
			inArray(contacts.lifecycleStage, AT_RISK_STAGES),
		),
		limit: 200,
	});

	const out: Array<{
		contact_id: string;
		full_name: string | null;
		email: string | null;
		score: number;
		risk_level: string;
		signals: Record<string, unknown>;
	}> = [];

	for (const c of rows) {
		const h = await recomputeContactHealth(workspaceId, c.id);
		if (h.risk_level === "high" || h.risk_level === "medium") {
			out.push({
				contact_id: c.id,
				full_name: c.fullName,
				email: c.email,
				score: h.score,
				risk_level: h.risk_level,
				signals: h.signals,
			});
		}
		if (out.length >= limit) break;
	}

	return out.sort((a, b) => a.score - b.score);
}
