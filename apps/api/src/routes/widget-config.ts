import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import {
	type WidgetPosition,
	type WidgetThemeConfig,
	DEFAULT_WIDGET_CONFIG,
	mergeWorkspaceWidgetSettings,
	parseWidgetConfig,
	widgetConfigToPublic,
} from "../lib/widget-settings.js";
import { getWorkspaceId } from "../lib/workspace.js";

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

export async function widgetConfigRoutes(app: FastifyInstance) {
	app.get<{ Params: { id: string } }>(
		"/v1/workspaces/:id/widget-config",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, request.params.id),
			});
			if (!ws) throw notFound("Workspace not found.");
			const config = parseWidgetConfig(ws.settings);
			return { data: widgetConfigToPublic(config) };
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

			const patch = parsePatch(request.body ?? {});
			if (Object.keys(patch).length === 0) {
				throw validationError("No valid fields to update.");
			}

			const nextSettings = mergeWorkspaceWidgetSettings(ws.settings, patch);
			const [updated] = await db
				.update(workspaces)
				.set({ settings: nextSettings, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId))
				.returning();

			if (!updated) throw notFound("Workspace not found.");
			return { data: widgetConfigToPublic(parseWidgetConfig(updated.settings)) };
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

	const config = parseWidgetConfig(ws.settings);
	return {
		workspace_id: ws.id,
		slug: ws.slug,
		...widgetConfigToPublic(config),
	};
}

export { DEFAULT_WIDGET_CONFIG };
