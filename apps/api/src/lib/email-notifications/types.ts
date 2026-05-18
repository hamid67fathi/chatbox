export type EmailNotificationKind =
	| "new_conversation"
	| "assigned"
	| "mention"
	| "suspicious_login";

export interface EmailNotificationJob {
	workspaceId: string;
	userId: string;
	toEmail: string;
	kind: EmailNotificationKind;
	subject: string;
	html: string;
	text: string;
}
