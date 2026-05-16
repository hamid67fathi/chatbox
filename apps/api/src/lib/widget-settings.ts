export type WidgetPosition = "left" | "right";

export interface WidgetThemeConfig {
	primaryColor: string;
	position: WidgetPosition;
	title: string;
	welcomeMessage: string;
	avatarUrl: string | null;
}

export const DEFAULT_WIDGET_CONFIG: WidgetThemeConfig = {
	primaryColor: "#2563eb",
	position: "right",
	title: "پشتیبانی",
	welcomeMessage: "سلام! چطور می‌توانیم کمکتان کنیم؟",
	avatarUrl: null,
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function parseWidgetConfig(raw: unknown): WidgetThemeConfig {
	const src =
		raw && typeof raw === "object" && "widget" in (raw as object)
			? (raw as { widget: unknown }).widget
			: raw;

	if (!src || typeof src !== "object") return { ...DEFAULT_WIDGET_CONFIG };

	const o = src as Record<string, unknown>;
	const position = o.position === "left" ? "left" : "right";
	const primaryColor =
		typeof o.primaryColor === "string" && HEX_COLOR.test(o.primaryColor)
			? o.primaryColor
			: typeof o.primary_color === "string" && HEX_COLOR.test(o.primary_color)
				? o.primary_color
				: DEFAULT_WIDGET_CONFIG.primaryColor;

	return {
		primaryColor,
		position,
		title:
			typeof o.title === "string" && o.title.trim()
				? o.title.trim().slice(0, 80)
				: DEFAULT_WIDGET_CONFIG.title,
		welcomeMessage:
			typeof o.welcomeMessage === "string"
				? o.welcomeMessage.trim().slice(0, 500)
				: typeof o.welcome_message === "string"
					? o.welcome_message.trim().slice(0, 500)
					: DEFAULT_WIDGET_CONFIG.welcomeMessage,
		avatarUrl:
			typeof o.avatarUrl === "string" && o.avatarUrl.trim()
				? o.avatarUrl.trim().slice(0, 500)
				: typeof o.avatar_url === "string" && o.avatar_url.trim()
					? o.avatar_url.trim().slice(0, 500)
					: null,
	};
}

export function widgetConfigToPublic(config: WidgetThemeConfig) {
	return {
		primary_color: config.primaryColor,
		position: config.position,
		title: config.title,
		welcome_message: config.welcomeMessage,
		avatar_url: config.avatarUrl,
	};
}

export function mergeWorkspaceWidgetSettings(
	settings: unknown,
	patch: Partial<WidgetThemeConfig>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseWidgetConfig(base);
	const next: WidgetThemeConfig = {
		primaryColor: patch.primaryColor ?? current.primaryColor,
		position: patch.position ?? current.position,
		title: patch.title ?? current.title,
		welcomeMessage: patch.welcomeMessage ?? current.welcomeMessage,
		avatarUrl:
			patch.avatarUrl !== undefined ? patch.avatarUrl : current.avatarUrl,
	};
	base.widget = next;
	return base;
}
