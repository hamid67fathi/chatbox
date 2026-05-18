export interface AutoTagSettings {
	enabled: boolean;
	auto_apply: boolean;
}

export const DEFAULT_AUTO_TAG_SETTINGS: AutoTagSettings = {
	enabled: true,
	auto_apply: true,
};

export function parseAutoTagSettings(settings: unknown): AutoTagSettings {
	if (!settings || typeof settings !== "object") {
		return { ...DEFAULT_AUTO_TAG_SETTINGS };
	}
	const root = settings as Record<string, unknown>;
	const raw = root.auto_tagging;
	if (!raw || typeof raw !== "object") {
		return { ...DEFAULT_AUTO_TAG_SETTINGS };
	}
	const o = raw as Record<string, unknown>;
	return {
		enabled: o.enabled !== false,
		auto_apply: o.auto_apply !== false,
	};
}

export function mergeAutoTagSettings(
	settings: unknown,
	patch: Partial<AutoTagSettings>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseAutoTagSettings(base);
	return {
		...base,
		auto_tagging: {
			enabled: patch.enabled ?? current.enabled,
			auto_apply: patch.auto_apply ?? current.auto_apply,
		},
	};
}

export function autoTagToPublic(config: AutoTagSettings) {
	return {
		enabled: config.enabled,
		auto_apply: config.auto_apply,
	};
}
