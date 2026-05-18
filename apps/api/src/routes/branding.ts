import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import { forbidden, validationError } from "../lib/errors.js";
import { notFound } from "../lib/errors.js";
import {
	getWorkspaceRole,
	isSupervisorRole,
} from "../lib/conversation-access.js";
import {
	brandingToPublic,
	isWhiteLabelActive,
	mergeWorkspaceBrandingSettings,
	parseWorkspaceBranding,
	resolveDashboardBranding,
	workspaceHasEnterprise,
	type WorkspaceBrandingConfig,
} from "../lib/workspace-branding.js";
import { getWorkspaceId } from "../lib/workspace.js";

function parseBrandingPatch(
	body: Record<string, unknown>,
): Partial<WorkspaceBrandingConfig> {
	const patch: Partial<WorkspaceBrandingConfig> = {};

	if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

	const logo =
		typeof body.logo_url === "string"
			? body.logo_url
			: typeof body.logoUrl === "string"
				? body.logoUrl
				: undefined;
	if (logo !== undefined) patch.logoUrl = logo.trim() || null;

	const color =
		typeof body.primary_color === "string"
			? body.primary_color
			: typeof body.primaryColor === "string"
				? body.primaryColor
				: undefined;
	if (color !== undefined) {
		if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
			throw validationError(
				"primary_color must be a hex color (#RRGGBB).",
				"primary_color",
			);
		}
		patch.primaryColor = color || null;
	}

	const title =
		typeof body.dashboard_title === "string"
			? body.dashboard_title
			: typeof body.dashboardTitle === "string"
				? body.dashboardTitle
				: undefined;
	if (title !== undefined) patch.dashboardTitle = title.trim() || null;

	if (typeof body.hide_powered_by === "boolean") {
		patch.hidePoweredBy = body.hide_powered_by;
	} else if (typeof body.hidePoweredBy === "boolean") {
		patch.hidePoweredBy = body.hidePoweredBy;
	}

	const domain =
		typeof body.custom_domain === "string"
			? body.custom_domain
			: typeof body.customDomain === "string"
				? body.customDomain
				: undefined;
	if (domain !== undefined) patch.customDomain = domain.trim() || null;

	const fromName =
		typeof body.email_from_name === "string"
			? body.email_from_name
			: typeof body.emailFromName === "string"
				? body.emailFromName
				: undefined;
	if (fromName !== undefined) patch.emailFromName = fromName.trim() || null;

	const wLabel =
		typeof body.widget_branding_label === "string"
			? body.widget_branding_label
			: typeof body.widgetBrandingLabel === "string"
				? body.widgetBrandingLabel
				: undefined;
	if (wLabel !== undefined) patch.widgetBrandingLabel = wLabel.trim() || null;

	const wUrl =
		typeof body.widget_branding_url === "string"
			? body.widget_branding_url
			: typeof body.widgetBrandingUrl === "string"
				? body.widgetBrandingUrl
				: undefined;
	if (wUrl !== undefined) patch.widgetBrandingUrl = wUrl.trim() || null;

	return patch;
}

export async function brandingRoutes(app: FastifyInstance) {
	app.get("/v1/branding", async (request) => {
		const wsId = getWorkspaceId(request);
		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, wsId),
		});
		if (!ws) throw notFound("Workspace not found.");

		const branding = parseWorkspaceBranding(ws.settings);
		const enterprise = await workspaceHasEnterprise(wsId);
		const active = isWhiteLabelActive(ws.plan, branding, enterprise);
		const dashboard = resolveDashboardBranding(branding, active);

		return {
			data: {
				enterprise,
				white_label_active: active,
				branding: brandingToPublic(branding),
				dashboard: {
					title: dashboard.title,
					logo_url: dashboard.logoUrl,
					primary_color: dashboard.primaryColor,
					hide_chatbox_brand: dashboard.hideChatboxBrand,
				},
			},
		};
	});

	app.put<{ Body: Record<string, unknown> }>(
		"/v1/branding",
		async (request) => {
			const wsId = getWorkspaceId(request);
			const user = (request as AuthenticatedRequest).user;
			const role = await getWorkspaceRole(wsId, user.id);
			if (!role || !isSupervisorRole(role)) {
				throw forbidden("Only workspace admins can update branding.");
			}

			const enterprise = await workspaceHasEnterprise(wsId);
			if (!enterprise) {
				throw forbidden(
					"White-label branding is available on the Enterprise plan only.",
				);
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, wsId),
			});
			if (!ws) throw notFound("Workspace not found.");

			const patch = parseBrandingPatch(request.body ?? {});
			const merged = mergeWorkspaceBrandingSettings(ws.settings, patch);

			const [updated] = await db
				.update(workspaces)
				.set({ settings: merged, updatedAt: new Date() })
				.where(eq(workspaces.id, wsId))
				.returning();

			if (!updated) throw notFound("Workspace not found.");

			const branding = parseWorkspaceBranding(updated.settings);
			const active = isWhiteLabelActive(updated.plan, branding, enterprise);
			const dashboard = resolveDashboardBranding(branding, active);

			auditLogFromRequest(request, {
				workspaceId: wsId,
				actorUserId: user.id,
				action: AUDIT_ACTIONS.BRANDING_UPDATE,
				targetType: "workspace",
				targetId: wsId,
				diff: { enabled: branding.enabled },
			});

			return {
				data: {
					enterprise: true,
					white_label_active: active,
					branding: brandingToPublic(branding),
					dashboard: {
						title: dashboard.title,
						logo_url: dashboard.logoUrl,
						primary_color: dashboard.primaryColor,
						hide_chatbox_brand: dashboard.hideChatboxBrand,
					},
				},
			};
		},
	);
}
