import { randomUUID } from "node:crypto";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	conversations,
	csatResponses,
	workspaces,
} from "../db/schema/index.js";
import {
	type CsatSettings,
	csatToPublic,
	parseCsatSettings,
} from "./csat-settings.js";

export async function getCsatSettings(
	workspaceId: string,
): Promise<CsatSettings> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	return parseCsatSettings(ws?.settings);
}

export async function hasCsatResponse(conversationId: string): Promise<boolean> {
	const row = await db.query.csatResponses.findFirst({
		where: eq(csatResponses.conversationId, conversationId),
		columns: { id: true },
	});
	return Boolean(row);
}

export async function getCsatPendingForConversation(
	workspaceId: string,
	conversationId: string,
): Promise<{ pending: boolean; prompt: string; ask_comment: boolean }> {
	const settings = await getCsatSettings(workspaceId);
	if (!settings.enabled) {
		return { pending: false, prompt: "", ask_comment: false };
	}

	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, conversationId),
			eq(conversations.workspaceId, workspaceId),
		),
		columns: { status: true, csatScore: true },
	});
	if (!conv) {
		return { pending: false, prompt: "", ask_comment: false };
	}

	const terminal =
		conv.status === "resolved" || conv.status === "closed";
	if (!terminal) {
		return { pending: false, prompt: "", ask_comment: false };
	}

	if (conv.csatScore != null || (await hasCsatResponse(conversationId))) {
		return { pending: false, prompt: "", ask_comment: false };
	}

	return {
		pending: true,
		prompt: settings.prompt_message,
		ask_comment: settings.ask_comment,
	};
}

export async function emitCsatRequest(
	workspaceId: string,
	conversationId: string,
): Promise<void> {
	const pending = await getCsatPendingForConversation(
		workspaceId,
		conversationId,
	);
	if (!pending.pending) return;

	await storeCsatInviteToken(conversationId, workspaceId);

	try {
		const { getIO } = await import("../ws/broadcast.js");
		const io = getIO();
		io.to(`conversation:${conversationId}`).emit("conv:csat_requested", {
			conversation_id: conversationId,
			prompt: pending.prompt,
			ask_comment: pending.ask_comment,
		});
	} catch {
		/* socket not ready */
	}
}

export async function submitCsatResponse(input: {
	workspaceId: string;
	conversationId: string;
	contactId: string;
	score: number;
	comment?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const score = Math.round(input.score);
	if (score < 1 || score > 5) {
		return { ok: false, error: "Score must be between 1 and 5." };
	}

	const settings = await getCsatSettings(input.workspaceId);
	if (!settings.enabled) {
		return { ok: false, error: "CSAT is disabled for this workspace." };
	}

	const conv = await db.query.conversations.findFirst({
		where: and(
			eq(conversations.id, input.conversationId),
			eq(conversations.workspaceId, input.workspaceId),
			eq(conversations.contactId, input.contactId),
		),
		columns: {
			id: true,
			status: true,
			assignedAgentId: true,
			csatScore: true,
		},
	});
	if (!conv) {
		return { ok: false, error: "Conversation not found." };
	}

	if (conv.csatScore != null || (await hasCsatResponse(conv.id))) {
		return { ok: false, error: "Feedback already submitted." };
	}

	const comment =
		typeof input.comment === "string" && input.comment.trim()
			? input.comment.trim().slice(0, 2000)
			: null;

	const token = randomUUID();

	await db.insert(csatResponses).values({
		workspaceId: input.workspaceId,
		conversationId: input.conversationId,
		contactId: input.contactId,
		assignedAgentId: conv.assignedAgentId,
		score,
		comment,
		token,
	});

	await db
		.update(conversations)
		.set({ csatScore: score, updatedAt: new Date() })
		.where(eq(conversations.id, input.conversationId));

	try {
		const { getIO } = await import("../ws/broadcast.js");
		const io = getIO();
		io.to(`workspace:${input.workspaceId}`).emit("conv:csat_submitted", {
			conversation_id: input.conversationId,
			score,
		});
	} catch {
		/* socket not ready */
	}

	return { ok: true };
}

export async function submitCsatByToken(
	token: string,
	score: number,
	comment?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const rows = await db
		.select({
			id: conversations.id,
			workspaceId: conversations.workspaceId,
			contactId: conversations.contactId,
		})
		.from(conversations)
		.where(sql`${conversations.metadata}->>'csat_invite_token' = ${token}`)
		.limit(1);

	const conv = rows[0];
	if (!conv) {
		return { ok: false, error: "Invalid or expired token." };
	}

	return submitCsatResponse({
		workspaceId: conv.workspaceId,
		conversationId: conv.id,
		contactId: conv.contactId,
		score,
		comment,
	});
}

export async function storeCsatInviteToken(
	conversationId: string,
	workspaceId: string,
): Promise<string | null> {
	const pending = await getCsatPendingForConversation(
		workspaceId,
		conversationId,
	);
	if (!pending.pending) return null;

	const conv = await db.query.conversations.findFirst({
		where: eq(conversations.id, conversationId),
		columns: { metadata: true },
	});
	const meta =
		conv?.metadata && typeof conv.metadata === "object"
			? { ...(conv.metadata as Record<string, unknown>) }
			: {};
	const token = randomUUID();
	meta.csat_invite_token = token;

	await db
		.update(conversations)
		.set({ metadata: meta, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));

	return token;
}

export interface CsatSummary {
	enabled: boolean;
	total_responses: number;
	average_score: number | null;
	by_agent: Array<{
		agent_id: string | null;
		agent_name: string | null;
		count: number;
		average_score: number;
	}>;
	distribution: Record<string, number>;
}

export async function getCsatSummary(
	workspaceId: string,
	from: Date,
	to: Date,
): Promise<CsatSummary> {
	const settings = await getCsatSettings(workspaceId);
	if (!settings.enabled) {
		return {
			enabled: false,
			total_responses: 0,
			average_score: null,
			by_agent: [],
			distribution: {},
		};
	}

	const rows = await db.query.csatResponses.findMany({
		where: and(
			eq(csatResponses.workspaceId, workspaceId),
			gte(csatResponses.createdAt, from),
			lte(csatResponses.createdAt, to),
		),
		with: {
			assignedAgent: {
				columns: { id: true, fullName: true, email: true },
			},
		},
	});

	const distribution: Record<string, number> = {
		"1": 0,
		"2": 0,
		"3": 0,
		"4": 0,
		"5": 0,
	};
	let sum = 0;
	const byAgentMap = new Map<
		string,
		{ name: string | null; sum: number; count: number }
	>();

	for (const row of rows) {
		sum += row.score;
		distribution[String(row.score)] =
			(distribution[String(row.score)] ?? 0) + 1;

		const agentKey = row.assignedAgentId ?? "unassigned";
		const existing = byAgentMap.get(agentKey) ?? {
			name:
				row.assignedAgent?.fullName ??
				row.assignedAgent?.email ??
				null,
			sum: 0,
			count: 0,
		};
		existing.sum += row.score;
		existing.count += 1;
		byAgentMap.set(agentKey, existing);
	}

	return {
		enabled: true,
		total_responses: rows.length,
		average_score:
			rows.length > 0 ? Math.round((sum / rows.length) * 10) / 10 : null,
		by_agent: [...byAgentMap.entries()].map(([agent_id, v]) => ({
			agent_id: agent_id === "unassigned" ? null : agent_id,
			agent_name: v.name,
			count: v.count,
			average_score: Math.round((v.sum / v.count) * 10) / 10,
		})),
		distribution,
	};
}

export { csatToPublic };
