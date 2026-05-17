import { eq } from "drizzle-orm";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "../../db/index.js";
import { workspaces } from "../../db/schema/index.js";
import {
	mergeEmailIntegration,
	parseEmailIntegration,
	type EmailIntegrationConfig,
} from "../../lib/email-settings.js";
import { handleInboundEmail, type ParsedInboundEmail } from "./inbound.js";

function extractText(parsed: Awaited<ReturnType<typeof simpleParser>>): string {
	if (parsed.text?.trim()) return parsed.text.trim();
	if (parsed.html) {
		return parsed.html
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}
	return "";
}

function parseFromAddress(
	from: Awaited<ReturnType<typeof simpleParser>>["from"],
): { email: string; name: string | null } | null {
	const value = from?.value?.[0];
	if (!value?.address) return null;
	return {
		email: value.address.trim().toLowerCase(),
		name: value.name?.trim() || null,
	};
}

async function pollWorkspace(workspaceId: string, config: EmailIntegrationConfig) {
	const client = new ImapFlow({
		host: config.imap.host,
		port: config.imap.port,
		secure: config.imap.secure,
		auth: { user: config.imap.user, pass: config.imap.password },
		logger: false,
	});

	let maxUid = config.imap_last_uid;

	try {
		await client.connect();
		const lock = await client.getMailboxLock("INBOX");
		try {
			const fetchQuery =
				maxUid > 0 ? { uid: `${maxUid + 1}:*` } : { seen: false };
			for await (const msg of client.fetch(fetchQuery, {
				uid: true,
				envelope: true,
				source: true,
			})) {
				if (!msg.source || !msg.uid) continue;
				if (msg.uid <= maxUid) continue;

				const parsed = await simpleParser(msg.source);
				const from = parseFromAddress(parsed.from);
				const text = extractText(parsed);
				if (!from?.email || !text) {
					maxUid = Math.max(maxUid, msg.uid);
					continue;
				}

				const messageId =
					parsed.messageId ??
					(typeof msg.envelope?.messageId === "string"
						? msg.envelope.messageId
						: `uid-${msg.uid}@${config.imap.host}`);

				const inbound: ParsedInboundEmail = {
					from_email: from.email,
					from_name: from.name,
					subject: parsed.subject?.trim() || msg.envelope?.subject || "(بدون موضوع)",
					text,
					message_id: messageId,
					in_reply_to:
						typeof parsed.inReplyTo === "string"
							? parsed.inReplyTo
							: null,
					references:
						typeof parsed.references === "string"
							? parsed.references
							: Array.isArray(parsed.references)
								? parsed.references.join(" ")
								: null,
				};

				try {
					await handleInboundEmail(workspaceId, inbound);
				} catch (err) {
					console.error(`[email] inbound failed ws=${workspaceId}:`, err);
				}

				maxUid = Math.max(maxUid, msg.uid);
			}
		} finally {
			lock.release();
		}
		await client.logout();
	} catch (err) {
		console.error(`[email] poll failed ws=${workspaceId}:`, err);
		return;
	}

	if (maxUid > config.imap_last_uid) {
		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, workspaceId),
		});
		if (!ws) return;
		const next = mergeEmailIntegration(ws.settings, {
			...config,
			imap_last_uid: maxUid,
		});
		await db
			.update(workspaces)
			.set({ settings: next, updatedAt: new Date() })
			.where(eq(workspaces.id, workspaceId));
	}
}

export async function pollAllWorkspaceEmails(): Promise<void> {
	const rows = await db.query.workspaces.findMany({
		columns: { id: true, settings: true },
	});

	for (const ws of rows) {
		const config = parseEmailIntegration(ws.settings);
		if (!config?.enabled) continue;
		await pollWorkspace(ws.id, config);
	}
}
