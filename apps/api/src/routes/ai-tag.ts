import type { FastifyInstance } from "fastify";
import { runAutoTagging } from "../lib/auto-tag.js";
import { validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function aiTagRoutes(app: FastifyInstance) {
	app.post<{
		Body: {
			conversation_id?: string;
			apply?: boolean;
			force?: boolean;
		};
	}>(
		"/v1/ai/tag",
		{ preHandler: [requireWorkspace("agent")] },
		async (request) => {
			const conversationId = request.body?.conversation_id?.trim();
			if (!conversationId) {
				throw validationError(
					"conversation_id is required.",
					"conversation_id",
				);
			}
			const wsId = getWorkspaceId(request);
			const result = await runAutoTagging(wsId, conversationId, {
				force: request.body?.force === true,
				apply: request.body?.apply !== false,
			});
			return { data: result };
		},
	);
}
