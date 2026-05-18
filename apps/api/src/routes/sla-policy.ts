import type { FastifyInstance } from "fastify";
import { validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getSlaPolicyForWorkspace, upsertSlaPolicy } from "../lib/sla/index.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function slaPolicyRoutes(app: FastifyInstance) {
	app.get(
		"/v1/sla-policy",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const policy = await getSlaPolicyForWorkspace(wsId);
			return { data: policy };
		},
	);

	app.patch<{
		Body: {
			enabled?: boolean;
			first_response_minutes?: number;
			resolution_minutes?: number;
			warn_at_percent?: number;
		};
	}>(
		"/v1/sla-policy",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const body = request.body ?? {};
			const patch: Record<string, unknown> = {};

			if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
			if (typeof body.first_response_minutes === "number") {
				if (body.first_response_minutes < 1 || body.first_response_minutes > 1440) {
					throw validationError(
						"first_response_minutes must be 1–1440.",
						"first_response_minutes",
					);
				}
				patch.first_response_minutes = Math.round(body.first_response_minutes);
			}
			if (typeof body.resolution_minutes === "number") {
				if (body.resolution_minutes < 5 || body.resolution_minutes > 10080) {
					throw validationError(
						"resolution_minutes must be 5–10080.",
						"resolution_minutes",
					);
				}
				patch.resolution_minutes = Math.round(body.resolution_minutes);
			}
			if (typeof body.warn_at_percent === "number") {
				patch.warn_at_percent = Math.min(
					99,
					Math.max(50, Math.round(body.warn_at_percent)),
				);
			}

			if (Object.keys(patch).length === 0) {
				throw validationError("No valid fields to update.");
			}

			const policy = await upsertSlaPolicy(wsId, patch);
			return { data: policy };
		},
	);
}
