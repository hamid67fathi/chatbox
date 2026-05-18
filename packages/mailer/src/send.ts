import nodemailer from "nodemailer";

export interface SmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	password: string;
	fromAddress: string;
	fromName?: string | null;
}

export async function sendNotificationEmail(
	smtp: SmtpConfig,
	opts: {
		to: string;
		subject: string;
		html: string;
		text: string;
	},
): Promise<void> {
	const transporter = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.secure,
		auth: { user: smtp.user, pass: smtp.password },
	});

	const fromName = smtp.fromName ?? "ChatBox";
	await transporter.sendMail({
		from: `"${fromName}" <${smtp.fromAddress}>`,
		to: opts.to,
		subject: opts.subject,
		html: opts.html,
		text: opts.text,
	});
}
