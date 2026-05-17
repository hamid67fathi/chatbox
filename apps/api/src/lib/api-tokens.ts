import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens } from "../db/schema/index.js";

export const API_TOKEN_PREFIX = "cbx_";

const MAX_TOKENS_PER_WORKSPACE = Number(
	process.env.API_TOKENS_MAX_PER_WORKSPACE ?? 20,
);

export interface VerifiedApiToken {
	id: string;
	workspaceId: string;
	createdByUserId: string;
	creatorEmail: string;
}

export function hashApiToken(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export function generateApiToken(): {
	raw: string;
	prefix: string;
	hash: string;
} {
	const secret = randomBytes(32).toString("base64url");
	const raw = `${API_TOKEN_PREFIX}${secret}`;
	const prefix = raw.slice(0, 12);
	return { raw, prefix, hash: hashApiToken(raw) };
}

export async function verifyApiToken(
	raw: string,
): Promise<VerifiedApiToken | null> {
	if (!raw.startsWith(API_TOKEN_PREFIX) || raw.length < 20) return null;

	const hash = hashApiToken(raw);
	const row = await db.query.apiTokens.findFirst({
		where: and(
			eq(apiTokens.tokenHash, hash),
			isNull(apiTokens.revokedAt),
		),
		with: { creator: true },
	});

	if (!row) return null;
	if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

	void db
		.update(apiTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiTokens.id, row.id));

	const email = row.creator?.email ?? `token@${row.id.slice(0, 8)}`;
	return {
		id: row.id,
		workspaceId: row.workspaceId,
		createdByUserId: row.createdBy,
		creatorEmail: email,
	};
}

export async function countActiveTokens(workspaceId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(apiTokens)
		.where(
			and(
				eq(apiTokens.workspaceId, workspaceId),
				isNull(apiTokens.revokedAt),
			),
		);
	return Number(row?.n ?? 0);
}

export { MAX_TOKENS_PER_WORKSPACE };
