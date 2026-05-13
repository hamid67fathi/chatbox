import type { FastifyRequest } from "fastify";
import { ApiError } from "./errors.js";

/** TODO: Replace with real auth (JWT + session) once Lucia is integrated. */
export function getWorkspaceId(request: FastifyRequest): string {
	const wsId = request.headers["x-workspace-id"];
	if (!wsId || typeof wsId !== "string") {
		throw new ApiError({
			code: "validation_error",
			message: "X-Workspace-Id header is required.",
			statusCode: 400,
		});
	}
	return wsId;
}
