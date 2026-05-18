import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import {
	type PrechatConfig,
	mergePrechatSettings,
	parsePrechatConfig,
	prechatToPublic,
} from "../lib/prechat-settings.js";
import {
	type WidgetTriggersConfig,
	mergeWidgetTriggers,
	parseWidgetTriggers,
	triggersToPublic,
} from "../lib/widget-triggers.js";
import {
	type WidgetPosition,
	type WidgetThemeConfig,
	mergeWorkspaceWidgetSettings,
	parseWidgetConfig,
	widgetConfigToPublic,
} from "../lib/widget-settings.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { getWorkspaceId } from "../lib/workspace.js";
import {
	businessHoursToPublic,
	mergeBusinessHoursSettings,
	parseBusinessHours,
	parseBusinessHoursPatch,
} from "../lib/business-hours.js";
import {
	aiLanguagesToPublic,
	mergeAiLanguageSettings,
	parseAiLanguageSettings,
} from "../lib/ai-language-settings.js";
import {
	autoTagToPublic,
	mergeAutoTagSettings,
	parseAutoTagSettings,
} from "../lib/auto-tag-settings.js";
import {
	csatToPublic,
	mergeCsatSettings,
	parseCsatSettings,
} from "../lib/csat-settings.js";
import { ensureTrackingPublicKey } from "../lib/tracking-key.js";
import { resolveWorkspaceWidgetBranding } from "../lib/widget-branding.js";
import {
	isWhiteLabelActive,
	parseWorkspaceBranding,
	workspaceHasEnterprise,
} from "../lib/workspace-branding.js";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function parsePatch(body: Record<string, unknown>): Partial<WidgetThemeConfig> {
	const patch: Partial<WidgetThemeConfig> = {};

	const color =
		typeof body.primary_color === "string"
			? body.primary_color
			: typeof body.primaryColor === "string"
				? body.primaryColor
				: undefined;
	if (color !== undefined) {
		if (!HEX_COLOR.test(color)) {
			throw validationError("primary_color must be a hex color (#RRGGBB).", "primary_color");
		}
		patch.primaryColor = color;
	}

	const position = body.position;
	if (position !== undefined) {
		if (position !== "left" && position !== "right") {
			throw validationError('position must be "left" or "right".', "position");
		}
		patch.position = position as WidgetPosition;
	}

	if (typeof body.title === "string") patch.title = body.title.trim();
	if (typeof body.welcome_message === "string") {
		patch.welcomeMessage = body.welcome_message;
	} else if (typeof body.welcomeMessage === "string") {
		patch.welcomeMessage = body.welcomeMessage;
	}

	if (body.avatar_url === null || body.avatar_url === "") {
		patch.avatarUrl = null;
	} else if (typeof body.avatar_url === "string") {
		patch.avatarUrl = body.avatar_url.trim();
	} else if (typeof body.avatarUrl === "string") {
		patch.avatarUrl = body.avatarUrl.trim();
	}

	return patch;
}

function parsePrechatPatch(body: Record<string, unknown>): Partial<PrechatConfig> {
	const patch: Partial<PrechatConfig> = {};
	const raw = body.prechat;
	if (!raw || typeof raw !== "object") return patch;
	const o = raw as Record<string, unknown>;
	if (typeof o.enabled === "boolean") patch.enabled = o.enabled;
	const fields = o.fields;
	if (fields && typeof fields === "object") {
		const f = fields as Record<string, unknown>;
		const nextFields: PrechatConfig["fields"] = {
			name: { enabled: false, required: false },
			email: { enabled: false, required: false },
			phone: { enabled: false, required: false },
		};
		for (const key of ["name", "email", "phone"] as const) {
			const field = f[key];
			if (field && typeof field === "object") {
				const fo = field as Record<string, unknown>;
				nextFields[key] = {
					enabled: fo.enabled === true,
					required: fo.required === true,
				};
			}
		}
		patch.fields = nextFields;
	}
	return patch;
}

function parseAiLanguagesPatch(body: Record<string, unknown>): Partial<{
	default_language: "fa" | "en" | "ar";
	translate_kb: boolean;
}> {
	const raw = body.ai_languages;
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const patch: Partial<{
		default_language: "fa" | "en" | "ar";
		translate_kb: boolean;
	}> = {};
	if (o.default_language === "fa" || o.default_language === "en" || o.default_language === "ar") {
		patch.default_language = o.default_language;
	}
	if (typeof o.translate_kb === "boolean") patch.translate_kb = o.translate_kb;
	return patch;
}

function parseAutoTagPatch(body: Record<string, unknown>): Partial<{
	enabled: boolean;
	auto_apply: boolean;
}> {
	const raw = body.auto_tagging;
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const patch: Partial<{ enabled: boolean; auto_apply: boolean }> = {};
	if (typeof o.enabled === "boolean") patch.enabled = o.enabled;
	if (typeof o.auto_apply === "boolean") patch.auto_apply = o.auto_apply;
	return patch;
}

function parseCsatPatch(body: Record<string, unknown>): Partial<{
	enabled: boolean;
	prompt_message: string;
	ask_comment: boolean;
}> {
	const raw = body.csat;
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const patch: Partial<{
		enabled: boolean;
		prompt_message: string;
		ask_comment: boolean;
	}> = {};
	if (typeof o.enabled === "boolean") patch.enabled = o.enabled;
	if (typeof o.prompt_message === "string") {
		patch.prompt_message = o.prompt_message;
	}
	if (typeof o.ask_comment === "boolean") patch.ask_comment = o.ask_comment;
	return patch;
}

function parseTriggersPatch(body: Record<string, unknown>): Partial<WidgetTriggersConfig> {
	const raw = body.triggers ?? body.widget_triggers;
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const patch: Partial<WidgetTriggersConfig> = {};
	if (typeof o.auto_open_delay_ms === "number") {
		patch.autoOpenDelayMs = o.auto_open_delay_ms;
	}
	if (typeof o.auto_open_on_scroll_percent === "number") {
		patch.autoOpenOnScrollPercent = o.auto_open_on_scroll_percent;
	} else if (o.auto_open_on_scroll_percent === null) {
		patch.autoOpenOnScrollPercent = null;
	}
	return patch;
}

function publicWidgetData(settings: unknown, workspaceTimezone?: string) {
	const businessHours = parseBusinessHours(settings, workspaceTimezone);
	return {
		...widgetConfigToPublic(parseWidgetConfig(settings)),
		prechat: prechatToPublic(parsePrechatConfig(settings)),
		triggers: triggersToPublic(parseWidgetTriggers(settings)),
		business_hours: businessHoursToPublic(businessHours),
		csat: csatToPublic(parseCsatSettings(settings)),
		auto_tagging: autoTagToPublic(parseAutoTagSettings(settings)),
		ai_languages: aiLanguagesToPublic(parseAiLanguageSettings(settings)),
	};
}

export async function widgetConfigRoutes(app: FastifyInstance) {
	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/widget-config",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, request.params.id),
			});
			if (!ws) throw notFound("Workspace not found.");
			return { data: publicWidgetData(ws.settings, ws.timezone) };
		},
	);

	app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
		"/v1/workspaces/:id/widget-config",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const body = request.body ?? {};
			const themePatch = parsePatch(body);
			const prechatPatch = parsePrechatPatch(body);
			const triggersPatch = parseTriggersPatch(body);
			const businessHoursPatch = parseBusinessHoursPatch(body);
			const csatPatch = parseCsatPatch(body);
			const autoTagPatch = parseAutoTagPatch(body);
			const aiLanguagesPatch = parseAiLanguagesPatch(body);

			const hasPrechatPatch =
				prechatPatch.enabled !== undefined ||
				(prechatPatch.fields &&
					Object.keys(prechatPatch.fields).length > 0);
			const hasTriggersPatch = Object.keys(triggersPatch).length > 0;
			const hasBusinessHoursPatch = Object.keys(businessHoursPatch).length > 0;
			const hasCsatPatch = Object.keys(csatPatch).length > 0;
			const hasAutoTagPatch = Object.keys(autoTagPatch).length > 0;
			const hasAiLanguagesPatch = Object.keys(aiLanguagesPatch).length > 0;

			if (
				Object.keys(themePatch).length === 0 &&
				!hasPrechatPatch &&
				!hasTriggersPatch &&
				!hasBusinessHoursPatch &&
				!hasCsatPatch &&
				!hasAutoTagPatch &&
				!hasAiLanguagesPatch
			) {
				throw validationError("No valid fields to update.");
			}

			let nextSettings = ws.settings as Record<string, unknown>;
			if (Object.keys(themePatch).length > 0) {
				nextSettings = mergeWorkspaceWidgetSettings(nextSettings, themePatch);
			}
			if (
				prechatPatch.enabled !== undefined ||
				prechatPatch.fields
			) {
				nextSettings = mergePrechatSettings(nextSettings, prechatPatch);
			}
			if (hasTriggersPatch) {
				nextSettings = mergeWidgetTriggers(nextSettings, triggersPatch);
			}
			if (hasBusinessHoursPatch) {
				nextSettings = mergeBusinessHoursSettings(
					nextSettings,
					businessHoursPatch,
				);
			}
			if (hasCsatPatch) {
				nextSettings = mergeCsatSettings(nextSettings, csatPatch);
			}
			if (hasAutoTagPatch) {
				nextSettings = mergeAutoTagSettings(nextSettings, autoTagPatch);
			}
			if (hasAiLanguagesPatch) {
				nextSettings = mergeAiLanguageSettings(nextSettings, aiLanguagesPatch);
			}

			const [updated] = await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId))
				.returning();

			if (!updated) throw notFound("Workspace not found.");
			const user = (request as AuthenticatedRequest).user;
			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.WIDGET_CONFIG_UPDATE,
				targetType: "workspace",
				targetId: wsId,
			});
			return {
				data: publicWidgetData(updated.settings, updated.timezone),
			};
		},
	);
}

export async function publicWidgetConfigHandler(
	workspaceSlug: string | undefined,
) {
	if (!workspaceSlug?.trim()) {
		throw validationError("workspace_slug is required.", "workspace_slug");
	}

	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.slug, workspaceSlug.trim()),
	});
	if (!ws) throw notFound("Workspace not found.");

	const branding = parseWorkspaceBranding(ws.settings);
	const enterprise = await workspaceHasEnterprise(ws.id);
	const whiteLabelActive = isWhiteLabelActive(ws.plan, branding, enterprise);
	const widgetBranding = await resolveWorkspaceWidgetBranding(ws.id);
	const trackingPublicKey = await ensureTrackingPublicKey(ws.id);
	const data = publicWidgetData(ws.settings, ws.timezone);
	if (whiteLabelActive && branding.primaryColor) {
		data.primary_color = branding.primaryColor;
	}

	return {
		workspace_id: ws.id,
		slug: ws.slug,
		tracking_public_key: trackingPublicKey,
		...data,
		show_branding: widgetBranding.show_branding,
		branding_label: widgetBranding.branding_label,
		branding_url: widgetBranding.branding_url,
	};
}
