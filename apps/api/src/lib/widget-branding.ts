import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { subscriptions, workspaces } from "../db/schema/index.js";
import {
	isWhiteLabelActive,
	parseWorkspaceBranding,
	resolveWidgetBrandingDisplay,
	workspaceHasEnterprise,
} from "./workspace-branding.js";

/** Paid subscription removes widget trademark footer. */
export async function shouldShowWidgetBranding(
	workspaceId: string,
): Promise<boolean> {
	const sub = await db.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.workspaceId, workspaceId),
			eq(subscriptions.status, "active"),
		),
		orderBy: [desc(subscriptions.createdAt)],
	});
	return !sub;
}

export async function resolveWorkspaceWidgetBranding(
	workspaceId: string,
): Promise<{
	show_branding: boolean;
	branding_label: string;
	branding_url: string;
}> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { plan: true, settings: true },
	});
	if (!ws) {
		return {
			show_branding: true,
			branding_label: DEFAULT_WIDGET_BRANDING.label,
			branding_url: DEFAULT_WIDGET_BRANDING.url,
		};
	}
	const branding = parseWorkspaceBranding(ws.settings);
	const enterprise = await workspaceHasEnterprise(workspaceId);
	const whiteLabelActive = isWhiteLabelActive(ws.plan, branding, enterprise);
	const fallbackShow = await shouldShowWidgetBranding(workspaceId);
	return resolveWidgetBrandingDisplay(
		branding,
		whiteLabelActive,
		fallbackShow,
	);
}

export const DEFAULT_WIDGET_BRANDING = {
	label: "قدرت گرفته از ChatBox",
	url: process.env.WIDGET_BRANDING_URL ?? "https://github.com/hamid67fathi/chatbox",
};
