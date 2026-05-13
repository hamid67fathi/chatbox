import type { FastifyRequest } from "fastify";
import { ApiError } from "./errors.js";

/**
 * Extract workspace ID from the X-Workspace-Id header.
 * After P4.2, RBAC middleware will verify the user actually belongs to this workspace.
 */
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
