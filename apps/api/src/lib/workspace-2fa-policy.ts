import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, workspaces } from "../db/schema/index.js";
import { forbidden } from "./auth.js";
import { isTotpEnabled } from "./two-factor.js";

export function parseRequire2fa(settings: unknown): boolean {
	if (!settings || typeof settings !== "object") return false;
	const security = (settings as { security?: unknown }).security;
	if (!security || typeof security !== "object") return false;
	const raw =
		(security as { require_2fa?: unknown }).require_2fa ??
		(security as { require2fa?: unknown }).require2fa;
	return raw === true;
}

export function mergeRequire2faSettings(
	settings: unknown,
	enabled: boolean,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const security =
		base.security && typeof base.security === "object"
			? { ...(base.security as Record<string, unknown>) }
			: {};
	security.require_2fa = enabled;
	base.security = security;
	return base;
}

export async function assertUser2faForWorkspace(
	userId: string,
	workspaceId: string,
): Promise<void> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
		columns: { settings: true },
	});
	if (!parseRequire2fa(ws?.settings)) return;

	const [u] = await db
		.select({ totpSecret: users.totpSecret })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!isTotpEnabled(u?.totpSecret)) {
		throw forbidden(
			"This workspace requires two-factor authentication. Enable 2FA in your profile settings.",
		);
	}
}
