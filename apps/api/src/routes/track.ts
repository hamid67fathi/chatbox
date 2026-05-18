import type { FastifyInstance } from "fastify";
import { validationError } from "../lib/errors.js";
import { resolveWorkspaceByTrackingKey } from "../lib/tracking-key.js";
import {
	isVisitorEventType,
	recordVisitorEvent,
	trackContextFromRequest,
} from "../lib/visitor-events.js";

export async function trackRoutes(app: FastifyInstance) {
	app.post<{
		Body: {
			workspace_key?: string;
			visitor_id?: string;
			event_type?: string;
			url?: string | null;
			referrer?: string | null;
			payload?: Record<string, unknown>;
			contact_id?: string | null;
		};
	}>(
		"/v1/track",
		{ config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const body = request.body ?? {};
			const workspaceKey = body.workspace_key?.trim();
			const visitorId = body.visitor_id?.trim();
			const eventType = body.event_type?.trim() ?? "";

			if (!workspaceKey) {
				throw validationError("workspace_key is required.", "workspace_key");
			}
			if (!visitorId) {
				throw validationError("visitor_id is required.", "visitor_id");
			}
			if (!isVisitorEventType(eventType)) {
				throw validationError(
					`event_type must be one of: page_view, session_start, session_end, conversation_started, custom_event.`,
					"event_type",
				);
			}

			const ws = await resolveWorkspaceByTrackingKey(workspaceKey);
			if (!ws) {
				throw validationError("Invalid workspace_key.", "workspace_key");
			}

			const ctx = trackContextFromRequest(request);

			await recordVisitorEvent({
				workspaceId: ws.id,
				visitorId,
				eventType,
				url: body.url,
				referrer:
					body.referrer ??
					(typeof request.headers.referer === "string"
						? request.headers.referer
						: null),
				payload: body.payload,
				contactId: body.contact_id ?? null,
				ip: ctx.ip,
				userAgent: ctx.userAgent,
			});

			return reply.status(204).send();
		},
	);
}
