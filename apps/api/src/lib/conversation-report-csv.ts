import { isArchived } from "./conversation-archive.js";

export type ReportRow = {
	id: string;
	createdAt: Date;
	lastMessageAt: Date | null;
	closedAt: Date | null;
	status: string;
	channel: string;
	subject: string | null;
	csatScore: number | null;
	firstResponseSec: number | null;
	metadata: unknown;
	contact: {
		fullName: string | null;
		email: string | null;
		phone: string | null;
	} | null;
	assignedAgent: { email: string | null; fullName: string | null } | null;
	tags: { tag: string }[];
	messageCount: number;
};

function csvCell(value: string | number | null | undefined): string {
	const s = value == null ? "" : String(value);
	if (/[",\n\r]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

function iso(d: Date | null | undefined): string {
	return d ? d.toISOString() : "";
}

export function conversationsToCsv(rows: ReportRow[]): string {
	const header = [
		"id",
		"created_at",
		"last_message_at",
		"closed_at",
		"status",
		"channel",
		"subject",
		"contact_name",
		"contact_email",
		"contact_phone",
		"assigned_agent",
		"tags",
		"message_count",
		"csat_score",
		"first_response_sec",
		"archived",
	].join(",");

	const lines = rows.map((r) =>
		[
			r.id,
			iso(r.createdAt),
			iso(r.lastMessageAt),
			iso(r.closedAt),
			r.status,
			r.channel,
			r.subject,
			r.contact?.fullName,
			r.contact?.email,
			r.contact?.phone,
			r.assignedAgent?.email ?? r.assignedAgent?.fullName,
			r.tags.map((t) => t.tag).join(";"),
			r.messageCount,
			r.csatScore,
			r.firstResponseSec,
			isArchived(r.metadata) ? "yes" : "no",
		]
			.map(csvCell)
			.join(","),
	);

	return `\uFEFF${header}\n${lines.join("\n")}\n`;
}
