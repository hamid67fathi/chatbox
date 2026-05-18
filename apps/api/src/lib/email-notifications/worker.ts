import { sendNotificationEmail, type SmtpConfig } from "@chatbox/mailer";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { workspaces } from "../../db/schema/index.js";
import { parseEmailIntegration } from "../email-settings.js";
import {
	isWhiteLabelActive,
	parseWorkspaceBranding,
	workspaceHasEnterprise,
} from "../workspace-branding.js";
import type { EmailNotificationJob } from "./types.js";

function smtpFromEnv(): SmtpConfig | null {
	const host = process.env.NOTIFICATION_SMTP_HOST?.trim();
	const user = process.env.NOTIFICATION_SMTP_USER?.trim();
	const password = process.env.NOTIFICATION_SMTP_PASSWORD;
	const fromAddress = process.env.NOTIFICATION_SMTP_FROM?.trim();
	if (!host || !user || !password || !fromAddress) return null;
	return {
		host,
		port: Number(process.env.NOTIFICATION_SMTP_PORT ?? 587),
		secure: process.env.NOTIFICATION_SMTP_SECURE === "true",
		user,
		password,
		fromName: process.env.NOTIFICATION_SMTP_FROM_NAME ?? "ChatBox",
		fromAddress,
	};
}

async function workspaceSmtp(workspaceId: string): Promise<SmtpConfig | null> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true, plan: true },
	});
	const integration = parseEmailIntegration(ws?.settings);
	const base = integration?.enabled
		? {
				host: integration.smtp.host,
				port: integration.smtp.port,
				secure: integration.smtp.secure,
				user: integration.smtp.user,
				password: integration.smtp.password,
				fromAddress: integration.from_address,
				fromName: integration.from_name,
			}
		: smtpFromEnv();
	if (!base) return null;

	const branding = parseWorkspaceBranding(ws?.settings);
	const enterprise = ws
		? await workspaceHasEnterprise(workspaceId)
		: false;
	if (
		ws &&
		isWhiteLabelActive(ws.plan, branding, enterprise) &&
		branding.emailFromName
	) {
		base.fromName = branding.emailFromName;
	}
	return base;
}

export async function processEmailNotificationJob(
	job: EmailNotificationJob,
): Promise<void> {
	const smtp = await workspaceSmtp(job.workspaceId);
	if (!smtp) return;

	await sendNotificationEmail(smtp, {
		to: job.toEmail,
		subject: job.subject,
		html: job.html,
		text: job.text,
	});
}
