export interface WidgetTriggersConfig {
	autoOpenDelayMs: number;
	autoOpenOnScrollPercent: number | null;
}

export const DEFAULT_WIDGET_TRIGGERS: WidgetTriggersConfig = {
	autoOpenDelayMs: 0,
	autoOpenOnScrollPercent: null,
};

export function parseWidgetTriggers(settings: unknown): WidgetTriggersConfig {
	const base =
		settings && typeof settings === "object"
			? (settings as Record<string, unknown>)
			: {};
	const raw = base.widget_triggers ?? base.triggers;
	if (!raw || typeof raw !== "object") return { ...DEFAULT_WIDGET_TRIGGERS };
	const o = raw as Record<string, unknown>;

	const delay =
		typeof o.auto_open_delay_ms === "number"
			? o.auto_open_delay_ms
			: typeof o.autoOpenDelayMs === "number"
				? o.autoOpenDelayMs
				: 0;

	const scroll =
		typeof o.auto_open_on_scroll_percent === "number"
			? o.auto_open_on_scroll_percent
			: typeof o.autoOpenOnScrollPercent === "number"
				? o.autoOpenOnScrollPercent
				: null;

	return {
		autoOpenDelayMs: Math.max(0, Math.min(delay, 120_000)),
		autoOpenOnScrollPercent:
			scroll != null ? Math.max(0, Math.min(scroll, 100)) : null,
	};
}

export function triggersToPublic(config: WidgetTriggersConfig) {
	return {
		auto_open_delay_ms: config.autoOpenDelayMs,
		auto_open_on_scroll_percent: config.autoOpenOnScrollPercent,
	};
}

export function mergeWidgetTriggers(
	settings: unknown,
	patch: Partial<WidgetTriggersConfig>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseWidgetTriggers(base);
	base.widget_triggers = {
		autoOpenDelayMs: patch.autoOpenDelayMs ?? current.autoOpenDelayMs,
		autoOpenOnScrollPercent:
			patch.autoOpenOnScrollPercent !== undefined
				? patch.autoOpenOnScrollPercent
				: current.autoOpenOnScrollPercent,
	};
	return base;
}
