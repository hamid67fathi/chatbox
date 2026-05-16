import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { contacts, conversations, messages, workspaces } from "../db/schema/index.js";
import {
	type VisitorTokenPayload,
	signVisitorToken,
	unauthorized,
	verifyToken,
} from "../lib/auth.js";
import { notFound, validationError } from "../lib/errors.js";
import {
	broadcastNewConversation,
	deliverNewMessage,
	triggerAIReply,
} from "../lib/message-delivery.js";

async function requireVisitorToken(
	request: FastifyRequest,
	_reply: FastifyReply,
): Promise<void> {
	const header = request.headers.authorization;
	if (!header?.startsWith("Bearer ")) throw unauthorized("Visitor token required.");

	const token = header.slice(7);
	try {
		const payload = await verifyToken<VisitorTokenPayload>(token);
		if (payload.type !== "visitor") throw unauthorized("Invalid token type.");
		(request as VisitorRequest).visitor = {
			contactId: payload.sub,
			workspaceId: payload.wid,
			conversationId: payload.cid,
		};
	} catch (err) {
		if (err instanceof Error && "statusCode" in err) throw err;
		throw unauthorized("Invalid or expired visitor token.");
	}
}

interface VisitorRequest extends FastifyRequest {
	visitor: { contactId: string; workspaceId: string; conversationId: string };
}

export async function widgetRoutes(app: FastifyInstance) {
	app.post<{
		Body: {
			workspace_slug: string;
			visitor_id?: string | null;
		};
	}>(
		"/widget/v1/sessions",
		{ config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const { workspace_slug, visitor_id } = request.body ?? {};
			if (!workspace_slug)
				throw validationError("workspace_slug is required.", "workspace_slug");

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.slug, workspace_slug),
			});
			if (!ws) throw notFound("Workspace not found.");

			let contact = visitor_id
				? await db.query.contacts.findFirst({
						where: and(
							eq(contacts.externalId, visitor_id),
							eq(contacts.workspaceId, ws.id),
						),
					})
				: null;

			if (!contact) {
				const newVisitorId = visitor_id ?? crypto.randomUUID();
				const [created] = await db
					.insert(contacts)
					.values({
						workspaceId: ws.id,
						externalId: newVisitorId,
						fullName: "Visitor",
					})
					.returning();
				contact = created;
			}

			const existingConv = await db.query.conversations.findFirst({
				where: and(
					eq(conversations.workspaceId, ws.id),
					eq(conversations.contactId, contact.id),
					eq(conversations.status, "open"),
				),
				orderBy: [desc(conversations.lastMessageAt), desc(conversations.createdAt)],
			});

			let conv = existingConv;
			if (!conv) {
				[conv] = await db
					.insert(conversations)
					.values({
						workspaceId: ws.id,
						contactId: contact.id,
						channel: "widget",
						status: "open",
					})
					.returning();
				broadcastNewConversation(conv, contact);
			}

			const token = await signVisitorToken(contact.id, ws.id, conv.id);

			return reply.status(201).send({
				workspace_id: ws.id,
				conversation_id: conv.id,
				contact_id: contact.id,
				token,
			});
		},
	);

	app.get(
		"/widget/v1/messages",
		{ preHandler: [requireVisitorToken] },
		async (request) => {
			const { workspaceId, conversationId } = (request as VisitorRequest).visitor;

			const rows = await db.query.messages.findMany({
				where: and(
					eq(messages.workspaceId, workspaceId),
					eq(messages.conversationId, conversationId),
				),
				limit: 100,
				orderBy: (m, { asc }) => [asc(m.createdAt)],
			});

			return { data: rows };
		},
	);

	app.post<{ Body: { body: string } }>(
		"/widget/v1/messages",
		{ preHandler: [requireVisitorToken] },
		async (request, reply) => {
			const { workspaceId, conversationId, contactId } = (request as VisitorRequest).visitor;
			const { body } = request.body ?? {};
			if (!body) throw validationError("body is required.", "body");

			const [msg] = await db
				.insert(messages)
				.values({
					workspaceId,
					conversationId,
					senderType: "contact",
					senderContactId: contactId,
					type: "text",
					body,
				})
				.returning();

			await deliverNewMessage(msg, conversationId, workspaceId);
			triggerAIReply(workspaceId, conversationId, body, msg.id);

			return reply.status(201).send(msg);
		},
	);
}
