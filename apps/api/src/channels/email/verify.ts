import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { EmailIntegrationConfig } from "../../lib/email-settings.js";

export async function verifyImapConnection(
	imap: EmailIntegrationConfig["imap"],
): Promise<void> {
	const client = new ImapFlow({
		host: imap.host,
		port: imap.port,
		secure: imap.secure,
		auth: { user: imap.user, pass: imap.password },
		logger: false,
	});
	await client.connect();
	await client.logout();
}

export async function verifySmtpConnection(
	smtp: EmailIntegrationConfig["smtp"],
	fromAddress: string,
): Promise<void> {
	const transporter = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.secure,
		auth: { user: smtp.user, pass: smtp.password },
	});
	await transporter.verify();
	void fromAddress;
}
