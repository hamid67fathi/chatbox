import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";

export type AiPersonaTone = "formal" | "friendly" | "technical";

export interface AiPersona {
	enabled: boolean;
	name: string | null;
	tone: AiPersonaTone;
	custom_instructions: string;
}

export const DEFAULT_AI_PERSONA: AiPersona = {
	enabled: true,
	name: null,
	tone: "friendly",
	custom_instructions: "",
};

export function parseAiPersona(raw: unknown): AiPersona {
	if (!raw || typeof raw !== "object") {
		return { ...DEFAULT_AI_PERSONA };
	}
	const o = raw as Record<string, unknown>;
	const tone = o.tone;
	const validTone =
		tone === "formal" || tone === "friendly" || tone === "technical"
			? tone
			: DEFAULT_AI_PERSONA.tone;
	const name =
		typeof o.name === "string" && o.name.trim()
			? o.name.trim().slice(0, 80)
			: null;
	const custom =
		typeof o.custom_instructions === "string"
			? o.custom_instructions.trim().slice(0, 2000)
			: "";
	return {
		enabled: o.enabled !== false,
		name,
		tone: validTone,
		custom_instructions: custom,
	};
}

export function aiPersonaToPublic(persona: AiPersona) {
	return { ...persona };
}

export function aiPersonaForAiService(persona: AiPersona) {
	if (!persona.enabled) return null;
	return {
		enabled: true,
		name: persona.name,
		tone: persona.tone,
		custom_instructions: persona.custom_instructions || null,
	};
}

export async function getWorkspaceAiPersona(
	workspaceId: string,
): Promise<AiPersona> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { aiPersona: true },
	});
	return parseAiPersona(ws?.aiPersona);
}

export async function updateWorkspaceAiPersona(
	workspaceId: string,
	patch: Partial<AiPersona>,
): Promise<AiPersona> {
	const current = await getWorkspaceAiPersona(workspaceId);
	const next: AiPersona = {
		enabled: patch.enabled ?? current.enabled,
		name: patch.name !== undefined ? patch.name : current.name,
		tone: patch.tone ?? current.tone,
		custom_instructions:
			patch.custom_instructions !== undefined
				? patch.custom_instructions
				: current.custom_instructions,
	};
	await db
		.update(workspaces)
		.set({ aiPersona: next, updatedAt: new Date() })
		.where(eq(workspaces.id, workspaceId));
	return next;
}
