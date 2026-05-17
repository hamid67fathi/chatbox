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
import { getWorkspaceId } from "../lib/workspace.js";
import {
	DEFAULT_WIDGET_BRANDING,
	shouldShowWidgetBranding,
} from "../lib/widget-branding.js";

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

function publicWidgetData(settings: unknown) {
	return {
		...widgetConfigToPublic(parseWidgetConfig(settings)),
		prechat: prechatToPublic(parsePrechatConfig(settings)),
		triggers: triggersToPublic(parseWidgetTriggers(settings)),
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
			return { data: publicWidgetData(ws.settings) };
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

			const hasPrechatPatch =
				prechatPatch.enabled !== undefined ||
				(prechatPatch.fields &&
					Object.keys(prechatPatch.fields).length > 0);
			const hasTriggersPatch = Object.keys(triggersPatch).length > 0;

			if (
				Object.keys(themePatch).length === 0 &&
				!hasPrechatPatch &&
				!hasTriggersPatch
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

			const [updated] = await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId))
				.returning();

			if (!updated) throw notFound("Workspace not found.");
			return { data: publicWidgetData(updated.settings) };
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

	const showBranding = await shouldShowWidgetBranding(ws.id);

	return {
		workspace_id: ws.id,
		slug: ws.slug,
		...publicWidgetData(ws.settings),
		show_branding: showBranding,
		branding_label: DEFAULT_WIDGET_BRANDING.label,
		branding_url: DEFAULT_WIDGET_BRANDING.url,
	};
}
