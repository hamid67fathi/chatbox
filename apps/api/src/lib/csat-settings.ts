export interface CsatSettings {
	enabled: boolean;
	prompt_message: string;
	ask_comment: boolean;
}

export const DEFAULT_CSAT_SETTINGS: CsatSettings = {
	enabled: true,
	prompt_message: "از ۱ تا ۵ چقدر از پشتیبانی راضی بودید؟",
	ask_comment: true,
};

export function parseCsatSettings(settings: unknown): CsatSettings {
	if (!settings || typeof settings !== "object") {
		return { ...DEFAULT_CSAT_SETTINGS };
	}
	const root = settings as Record<string, unknown>;
	const csat = root.csat;
	if (!csat || typeof csat !== "object") {
		return { ...DEFAULT_CSAT_SETTINGS };
	}
	const o = csat as Record<string, unknown>;
	return {
		enabled: o.enabled !== false,
		prompt_message:
			typeof o.prompt_message === "string" && o.prompt_message.trim()
				? o.prompt_message.trim().slice(0, 500)
				: DEFAULT_CSAT_SETTINGS.prompt_message,
		ask_comment: o.ask_comment !== false,
	};
}

export function mergeCsatSettings(
	settings: unknown,
	patch: Partial<CsatSettings>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseCsatSettings(base);
	return {
		...base,
		csat: {
			enabled: patch.enabled ?? current.enabled,
			prompt_message: patch.prompt_message ?? current.prompt_message,
			ask_comment: patch.ask_comment ?? current.ask_comment,
		},
	};
}

export function csatToPublic(config: CsatSettings) {
	return {
		enabled: config.enabled,
		prompt_message: config.prompt_message,
		ask_comment: config.ask_comment,
	};
}
