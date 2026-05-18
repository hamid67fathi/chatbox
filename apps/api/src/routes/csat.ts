import type { FastifyInstance } from "fastify";
import { getCsatSummary, submitCsatByToken } from "../lib/csat-service.js";
import { validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

export async function publicCsatRoutes(app: FastifyInstance) {
	app.post<{
		Params: { token: string };
		Body: { score?: number; comment?: string | null };
	}>(
		"/v1/csat/:token",
		{ config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
		async (request, reply) => {
			const score = request.body?.score;
			if (typeof score !== "number") {
				throw validationError("score is required.", "score");
			}

			const result = await submitCsatByToken(
				request.params.token,
				score,
				request.body?.comment,
			);
			if (!result.ok) {
				return reply.status(400).send({
					error: { message: result.error },
				});
			}
			return reply.status(201).send({ ok: true });
		},
	);
}

export async function csatReportRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: { from?: string; to?: string };
	}>(
		"/v1/reports/csat-summary",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const fromRaw = request.query.from;
			const toRaw = request.query.to;
			if (!fromRaw || !toRaw) {
				throw validationError("from and to are required.", "from");
			}
			const from = new Date(fromRaw);
			const to = new Date(toRaw);
			if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
				throw validationError("Invalid date range.", "from");
			}
			const data = await getCsatSummary(wsId, from, to);
			return { data };
		},
	);
}
