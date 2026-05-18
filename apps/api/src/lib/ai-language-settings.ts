import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { localeToLang } from "./language-utils.js";

export interface AiLanguageSettings {
	default_language: "fa" | "en" | "ar";
	translate_kb: boolean;
}

export const DEFAULT_AI_LANGUAGE_SETTINGS: AiLanguageSettings = {
	default_language: "fa",
	translate_kb: false,
};

export function parseAiLanguageSettings(settings: unknown): AiLanguageSettings {
	if (!settings || typeof settings !== "object") {
		return { ...DEFAULT_AI_LANGUAGE_SETTINGS };
	}
	const root = settings as Record<string, unknown>;
	const raw = root.ai_languages;
	if (!raw || typeof raw !== "object") {
		return { ...DEFAULT_AI_LANGUAGE_SETTINGS };
	}
	const o = raw as Record<string, unknown>;
	const lang = o.default_language;
	const default_language =
		lang === "en" || lang === "ar" || lang === "fa" ? lang : "fa";
	return {
		default_language,
		translate_kb: o.translate_kb === true,
	};
}

export function mergeAiLanguageSettings(
	settings: unknown,
	patch: Partial<AiLanguageSettings>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseAiLanguageSettings(base);
	return {
		...base,
		ai_languages: {
			default_language:
				patch.default_language ?? current.default_language,
			translate_kb: patch.translate_kb ?? current.translate_kb,
		},
	};
}

export function aiLanguagesToPublic(config: AiLanguageSettings) {
	return {
		default_language: config.default_language,
		translate_kb: config.translate_kb,
	};
}

export async function getWorkspaceAiLanguage(
	workspaceId: string,
): Promise<AiLanguageSettings> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true, locale: true },
	});
	if (!ws) return { ...DEFAULT_AI_LANGUAGE_SETTINGS };
	const parsed = parseAiLanguageSettings(ws.settings);
	if (
		!ws.settings ||
		typeof ws.settings !== "object" ||
		!(ws.settings as Record<string, unknown>).ai_languages
	) {
		return {
			...parsed,
			default_language: localeToLang(ws.locale),
		};
	}
	return parsed;
}
