import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions, workspaces } from "../db/schema/index.js";
import { DEFAULT_WIDGET_BRANDING } from "./widget-branding.js";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export interface WorkspaceBrandingConfig {
	enabled: boolean;
	logoUrl: string | null;
	primaryColor: string | null;
	dashboardTitle: string | null;
	hidePoweredBy: boolean;
	customDomain: string | null;
	emailFromName: string | null;
	widgetBrandingLabel: string | null;
	widgetBrandingUrl: string | null;
}

export interface WorkspaceBrandingPublic {
	enabled: boolean;
	logo_url: string | null;
	primary_color: string | null;
	dashboard_title: string | null;
	hide_powered_by: boolean;
	custom_domain: string | null;
	email_from_name: string | null;
	widget_branding_label: string | null;
	widget_branding_url: string | null;
}

const DEFAULTS: WorkspaceBrandingConfig = {
	enabled: false,
	logoUrl: null,
	primaryColor: null,
	dashboardTitle: null,
	hidePoweredBy: false,
	customDomain: null,
	emailFromName: null,
	widgetBrandingLabel: null,
	widgetBrandingUrl: null,
};

export function parseWorkspaceBranding(settings: unknown): WorkspaceBrandingConfig {
	if (!settings || typeof settings !== "object") return { ...DEFAULTS };
	const raw =
		(settings as { branding?: unknown }).branding ??
		(settings as { white_label?: unknown }).white_label;
	if (!raw || typeof raw !== "object") return { ...DEFAULTS };
	const o = raw as Record<string, unknown>;

	const primary =
		typeof o.primaryColor === "string"
			? o.primaryColor
			: typeof o.primary_color === "string"
				? o.primary_color
				: null;

	return {
		enabled: o.enabled === true,
		logoUrl:
			typeof o.logoUrl === "string" && o.logoUrl.trim()
				? o.logoUrl.trim().slice(0, 500)
				: typeof o.logo_url === "string" && o.logo_url.trim()
					? o.logo_url.trim().slice(0, 500)
					: null,
		primaryColor:
			primary && HEX_COLOR.test(primary) ? primary : null,
		dashboardTitle:
			typeof o.dashboardTitle === "string" && o.dashboardTitle.trim()
				? o.dashboardTitle.trim().slice(0, 80)
				: typeof o.dashboard_title === "string" && o.dashboard_title.trim()
					? o.dashboard_title.trim().slice(0, 80)
					: null,
		hidePoweredBy:
			o.hidePoweredBy === true ||
			o.hide_powered_by === true,
		customDomain:
			typeof o.customDomain === "string" && o.customDomain.trim()
				? o.customDomain.trim().slice(0, 253)
				: typeof o.custom_domain === "string" && o.custom_domain.trim()
					? o.custom_domain.trim().slice(0, 253)
					: null,
		emailFromName:
			typeof o.emailFromName === "string" && o.emailFromName.trim()
				? o.emailFromName.trim().slice(0, 80)
				: typeof o.email_from_name === "string" && o.email_from_name.trim()
					? o.email_from_name.trim().slice(0, 80)
					: null,
		widgetBrandingLabel:
			typeof o.widgetBrandingLabel === "string"
				? o.widgetBrandingLabel.trim().slice(0, 120)
				: typeof o.widget_branding_label === "string"
					? o.widget_branding_label.trim().slice(0, 120)
					: null,
		widgetBrandingUrl:
			typeof o.widgetBrandingUrl === "string"
				? o.widgetBrandingUrl.trim().slice(0, 500)
				: typeof o.widget_branding_url === "string"
					? o.widget_branding_url.trim().slice(0, 500)
					: null,
	};
}

export function brandingToPublic(
	config: WorkspaceBrandingConfig,
): WorkspaceBrandingPublic {
	return {
		enabled: config.enabled,
		logo_url: config.logoUrl,
		primary_color: config.primaryColor,
		dashboard_title: config.dashboardTitle,
		hide_powered_by: config.hidePoweredBy,
		custom_domain: config.customDomain,
		email_from_name: config.emailFromName,
		widget_branding_label: config.widgetBrandingLabel,
		widget_branding_url: config.widgetBrandingUrl,
	};
}

export function mergeWorkspaceBrandingSettings(
	settings: unknown,
	patch: Partial<WorkspaceBrandingConfig>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseWorkspaceBranding(base);
	const next: WorkspaceBrandingConfig = {
		...current,
		...patch,
	};
	base.branding = {
		enabled: next.enabled,
		logo_url: next.logoUrl,
		primary_color: next.primaryColor,
		dashboard_title: next.dashboardTitle,
		hide_powered_by: next.hidePoweredBy,
		custom_domain: next.customDomain,
		email_from_name: next.emailFromName,
		widget_branding_label: next.widgetBrandingLabel,
		widget_branding_url: next.widgetBrandingUrl,
	};
	return base;
}

export async function workspaceHasEnterprise(
	workspaceId: string,
): Promise<boolean> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { plan: true },
	});
	if (ws?.plan === "enterprise") return true;

	const sub = await db.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.workspaceId, workspaceId),
			eq(subscriptions.status, "active"),
		),
		orderBy: [desc(subscriptions.createdAt)],
	});
	return sub?.plan === "enterprise";
}

export function isWhiteLabelActive(
	_plan: string,
	branding: WorkspaceBrandingConfig,
	hasEnterprise: boolean,
): boolean {
	return hasEnterprise && branding.enabled;
}

export function resolveWidgetBrandingDisplay(
	branding: WorkspaceBrandingConfig,
	whiteLabelActive: boolean,
	fallbackShowBranding: boolean,
): {
	show_branding: boolean;
	branding_label: string;
	branding_url: string;
} {
	if (whiteLabelActive && branding.hidePoweredBy) {
		return {
			show_branding: false,
			branding_label: "",
			branding_url: "",
		};
	}
	if (whiteLabelActive && branding.widgetBrandingLabel) {
		return {
			show_branding: true,
			branding_label: branding.widgetBrandingLabel,
			branding_url:
				branding.widgetBrandingUrl ?? DEFAULT_WIDGET_BRANDING.url,
		};
	}
	return {
		show_branding: fallbackShowBranding,
		branding_label: DEFAULT_WIDGET_BRANDING.label,
		branding_url: DEFAULT_WIDGET_BRANDING.url,
	};
}

export function resolveDashboardBranding(
	branding: WorkspaceBrandingConfig,
	whiteLabelActive: boolean,
): {
	title: string;
	logoUrl: string | null;
	primaryColor: string | null;
	hideChatboxBrand: boolean;
} {
	if (!whiteLabelActive) {
		return {
			title: "ChatBox",
			logoUrl: null,
			primaryColor: null,
			hideChatboxBrand: false,
		};
	}
	return {
		title: branding.dashboardTitle?.trim() || "داشبورد",
		logoUrl: branding.logoUrl,
		primaryColor: branding.primaryColor,
		hideChatboxBrand: branding.hidePoweredBy,
	};
}
