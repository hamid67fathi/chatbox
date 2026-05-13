import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { contacts, conversations, workspaces } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";

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
						where: eq(contacts.externalId, visitor_id),
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

			const [conv] = await db
				.insert(conversations)
				.values({
					workspaceId: ws.id,
					contactId: contact.id,
					channel: "widget",
					status: "open",
				})
				.returning();

			return reply.status(201).send({
				workspace_id: ws.id,
				conversation_id: conv.id,
				contact_id: contact.id,
			});
		},
	);
}
