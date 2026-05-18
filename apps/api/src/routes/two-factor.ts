import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import {
	type AuthenticatedRequest,
	forbidden,
	requireAuth,
	unauthorized,
} from "../lib/auth.js";
import { finishAuthLogin } from "../lib/finish-auth-login.js";
import { ApiError, validationError } from "../lib/errors.js";
import { AUDIT_ACTIONS, auditLogFromRequest } from "../lib/audit-log.js";
import {
	buildOtpAuthUrl,
	generateRecoveryCodeHashes,
	generateTotpSecret,
	isTotpEnabled,
	pendingTotpSecret,
	qrDataUrlForOtpAuth,
	verifyPasswordFor2fa,
	verifyTotpCode,
	verifyTotpOrRecovery,
	verifyTwoFactorPendingToken,
	wrapPendingSecret,
} from "../lib/two-factor.js";

async function loadUser2faRow(userId: string) {
	const [row] = await db
		.select({
			id: users.id,
			email: users.email,
			passwordHash: users.passwordHash,
			totpSecret: users.totpSecret,
			totpRecoveryHashes: users.totpRecoveryHashes,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return row ?? null;
}

export async function twoFactorRoutes(app: FastifyInstance) {
	app.get(
		"/v1/auth/2fa/status",
		{ preHandler: [requireAuth] },
		async (request) => {
			const { id } = (request as AuthenticatedRequest).user;
			const row = await loadUser2faRow(id);
			if (!row) throw unauthorized("User not found.");
			return {
				enabled: isTotpEnabled(row.totpSecret),
				has_password: Boolean(row.passwordHash),
			};
		},
	);

	app.post(
		"/v1/auth/2fa/setup",
		{ preHandler: [requireAuth] },
		async (request, reply) => {
			const { id, email } = (request as AuthenticatedRequest).user;
			const row = await loadUser2faRow(id);
			if (!row?.email) throw unauthorized("User not found.");
			if (isTotpEnabled(row.totpSecret)) {
				throw new ApiError({
					code: "conflict",
					message: "2FA is already enabled. Disable it first to reconfigure.",
					statusCode: 409,
				});
			}

			const secret = generateTotpSecret();
			await db
				.update(users)
				.set({
					totpSecret: wrapPendingSecret(secret),
					totpRecoveryHashes: null,
					updatedAt: new Date(),
				})
				.where(eq(users.id, id));

			const otpauthUrl = buildOtpAuthUrl(email, secret);
			const qr_data_url = await qrDataUrlForOtpAuth(otpauthUrl);

			return reply.send({
				secret,
				otpauth_url: otpauthUrl,
				qr_data_url,
			});
		},
	);

	app.post<{
		Body: { code?: string };
	}>(
		"/v1/auth/2fa/verify",
		{ preHandler: [requireAuth] },
		async (request, reply) => {
			const { id } = (request as AuthenticatedRequest).user;
			const code = request.body?.code?.trim();
			if (!code) throw validationError("code is required.", "code");

			const row = await loadUser2faRow(id);
			if (!row) throw unauthorized("User not found.");

			const pending = pendingTotpSecret(row.totpSecret);
			if (!pending) {
				throw new ApiError({
					code: "invalid_state",
					message: "Call /v1/auth/2fa/setup first.",
					statusCode: 400,
				});
			}

			if (!verifyTotpCode(pending, code)) {
				throw unauthorized("Invalid authenticator code.");
			}

			const { plain, hashedJson } = await generateRecoveryCodeHashes();
			await db
				.update(users)
				.set({
					totpSecret: pending,
					totpRecoveryHashes: hashedJson,
					updatedAt: new Date(),
				})
				.where(eq(users.id, id));

			auditLogFromRequest(request, {
				workspaceId: null,
				actorUserId: id,
				action: AUDIT_ACTIONS.AUTH_2FA_ENABLE,
				targetType: "user",
				targetId: id,
			});

			return reply.send({
				enabled: true,
				recovery_codes: plain,
			});
		},
	);

	app.post<{
		Body: { code?: string; recovery_code?: string; password?: string };
	}>(
		"/v1/auth/2fa/disable",
		{ preHandler: [requireAuth] },
		async (request, reply) => {
			const { id } = (request as AuthenticatedRequest).user;
			const row = await loadUser2faRow(id);
			if (!row) throw unauthorized("User not found.");
			if (!isTotpEnabled(row.totpSecret)) {
				return reply.send({ enabled: false });
			}

			const passwordOk = await verifyPasswordFor2fa(
				request.body?.password,
				row.passwordHash,
			);
			if (!passwordOk) {
				throw forbidden("Password is required to disable 2FA.");
			}

			const verified = await verifyTotpOrRecovery({
				totpSecret: row.totpSecret,
				recoveryHashesJson: row.totpRecoveryHashes,
				code: request.body?.code,
				recoveryCode: request.body?.recovery_code,
			});
			if (!verified.ok) {
				throw unauthorized("Invalid authenticator or recovery code.");
			}

			await db
				.update(users)
				.set({
					totpSecret: null,
					totpRecoveryHashes: null,
					updatedAt: new Date(),
				})
				.where(eq(users.id, id));

			auditLogFromRequest(request, {
				workspaceId: null,
				actorUserId: id,
				action: AUDIT_ACTIONS.AUTH_2FA_DISABLE,
				targetType: "user",
				targetId: id,
			});

			return reply.send({ enabled: false });
		},
	);

	app.post<{
		Body: {
			pending_token?: string;
			code?: string;
			recovery_code?: string;
		};
	}>("/v1/auth/login/2fa", async (request, reply) => {
		const pendingToken = request.body?.pending_token?.trim();
		if (!pendingToken) {
			throw validationError("pending_token is required.", "pending_token");
		}

		let pending: { sub: string; email: string };
		try {
			pending = await verifyTwoFactorPendingToken(pendingToken);
		} catch {
			throw unauthorized("Invalid or expired login session.");
		}

		const row = await loadUser2faRow(pending.sub);
		if (!row?.email || !isTotpEnabled(row.totpSecret)) {
			throw unauthorized("Two-factor authentication is not enabled.");
		}

		const verified = await verifyTotpOrRecovery({
			totpSecret: row.totpSecret,
			recoveryHashesJson: row.totpRecoveryHashes,
			code: request.body?.code,
			recoveryCode: request.body?.recovery_code,
		});
		if (!verified.ok) {
			throw unauthorized("Invalid authenticator or recovery code.");
		}

		if (verified.usedRecovery && verified.remainingHashes) {
			await db
				.update(users)
				.set({
					totpRecoveryHashes: JSON.stringify(verified.remainingHashes),
					updatedAt: new Date(),
				})
				.where(eq(users.id, row.id));
		}

		const result = await finishAuthLogin(
			request,
			{
				id: row.id,
				email: row.email,
				fullName: null,
			},
			AUDIT_ACTIONS.AUTH_LOGIN,
		);

		const [full] = await db
			.select({ fullName: users.fullName })
			.from(users)
			.where(eq(users.id, row.id))
			.limit(1);

		return reply.send({
			...result,
			user: { ...result.user, full_name: full?.fullName ?? null },
		});
	});
}

export async function maybeRequire2faForLogin(
	request: FastifyRequest,
	user: { id: string; email: string; fullName: string | null; totpSecret: string | null },
	auditAction: string = AUDIT_ACTIONS.AUTH_LOGIN,
): Promise<
	| { requires_2fa: true; pending_token: string }
	| { requires_2fa: false; result: Awaited<ReturnType<typeof finishAuthLogin>> }
> {
	if (!isTotpEnabled(user.totpSecret)) {
		return {
			requires_2fa: false,
			result: await finishAuthLogin(request, user, auditAction),
		};
	}

	const { signTwoFactorPendingToken } = await import("../lib/two-factor.js");
	const pending_token = await signTwoFactorPendingToken(user.id, user.email);
	return { requires_2fa: true, pending_token };
}
