import { and, desc, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { apiTokens } from "../db/schema/index.js";
import type { AuthenticatedRequest } from "../lib/auth.js";
import {
	generateApiToken,
	MAX_TOKENS_PER_WORKSPACE,
	countActiveTokens,
} from "../lib/api-tokens.js";
import { conflict, notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";

export async function apiTokenRoutes(app: FastifyInstance) {
	app.get<{ Params: { workspace_id: string } }>(
		"/v1/workspaces/:workspace_id/api-tokens",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = request.params.workspace_id;
			const rows = await db.query.apiTokens.findMany({
				where: and(
					eq(apiTokens.workspaceId, wsId),
					isNull(apiTokens.revokedAt),
				),
				orderBy: [desc(apiTokens.createdAt)],
				with: { creator: true },
			});

			return {
				data: rows.map((t) => ({
					id: t.id,
					name: t.name,
					token_prefix: t.tokenPrefix,
					created_by: t.createdBy,
					creator_email: t.creator?.email ?? null,
					last_used_at: t.lastUsedAt?.toISOString() ?? null,
					expires_at: t.expiresAt?.toISOString() ?? null,
					created_at: t.createdAt.toISOString(),
				})),
			};
		},
	);

	app.post<{
		Params: { workspace_id: string };
		Body: { name?: string; expires_in_days?: number };
	}>(
		"/v1/workspaces/:workspace_id/api-tokens",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = request.params.workspace_id;
			const user = (request as AuthenticatedRequest).user;
			const { name, expires_in_days } = request.body ?? {};

			const label = name?.trim();
			if (!label) throw validationError("name is required.", "name");

			const active = await countActiveTokens(wsId);
			if (active >= MAX_TOKENS_PER_WORKSPACE) {
				throw conflict(
					`Maximum ${MAX_TOKENS_PER_WORKSPACE} active API tokens per workspace.`,
				);
			}

			const { raw, prefix, hash } = generateApiToken();
			let expiresAt: Date | undefined;
			if (expires_in_days != null && expires_in_days > 0) {
				expiresAt = new Date();
				expiresAt.setUTCDate(expiresAt.getUTCDate() + expires_in_days);
			}

			const [row] = await db
				.insert(apiTokens)
				.values({
					workspaceId: wsId,
					createdBy: user.id,
					name: label,
					tokenPrefix: prefix,
					tokenHash: hash,
					expiresAt,
				})
				.returning();

			return reply.status(201).send({
				token: raw,
				token_prefix: prefix,
				id: row.id,
				name: row.name,
				expires_at: row.expiresAt?.toISOString() ?? null,
				message:
					"این توکن فقط یک‌بار نمایش داده می‌شود. آن را در جای امن ذخیره کنید.",
			});
		},
	);

	app.delete<{ Params: { workspace_id: string; token_id: string } }>(
		"/v1/workspaces/:workspace_id/api-tokens/:token_id",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const { workspace_id, token_id } = request.params;

			const [revoked] = await db
				.update(apiTokens)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(apiTokens.id, token_id),
						eq(apiTokens.workspaceId, workspace_id),
						isNull(apiTokens.revokedAt),
					),
				)
				.returning();

			if (!revoked) throw notFound("API token not found.");
			return { ok: true };
		},
	);
}
