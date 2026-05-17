import nodemailer from "nodemailer";
import type { EmailIntegrationConfig } from "../../lib/email-settings.js";

export interface SendEmailOptions {
	to: string;
	subject: string;
	text: string;
	inReplyTo?: string | null;
	references?: string | null;
}

export async function sendEmailViaSmtp(
	config: EmailIntegrationConfig,
	options: SendEmailOptions,
): Promise<{ messageId: string }> {
	const transporter = nodemailer.createTransport({
		host: config.smtp.host,
		port: config.smtp.port,
		secure: config.smtp.secure,
		auth: {
			user: config.smtp.user,
			pass: config.smtp.password,
		},
	});

	const fromName = config.from_name ?? "ChatBox Support";
	const domain = config.from_address.split("@")[1] ?? "chatbox.local";
	const generatedId = `<cb-${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;

	const info = await transporter.sendMail({
		from: `"${fromName}" <${config.from_address}>`,
		to: options.to,
		subject: options.subject,
		text: options.text,
		inReplyTo: options.inReplyTo ?? undefined,
		references: options.references ?? undefined,
		messageId: generatedId,
	});

	const sentId =
		(typeof info.messageId === "string" && info.messageId) || generatedId;
	return { messageId: sentId };
}
