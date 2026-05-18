import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import { ensureDemoWorkspaceMembership } from "../lib/auth-sessions.js";
import { maybeRequire2faForLogin } from "./two-factor.js";
import { findOrCreateGoogleUser } from "../lib/google-auth-user.js";
import {
	buildGoogleAuthUrl,
	exchangeGoogleCode,
	fetchGoogleUserProfile,
	getDashboardOAuthRedirectUrl,
	isGoogleOAuthConfigured,
} from "../lib/google-oauth.js";
import { AUDIT_ACTIONS } from "../lib/audit-log.js";
import { ApiError } from "../lib/errors.js";

const OAUTH_STATE_COOKIE = "oauth_state";

export async function googleAuthRoutes(app: FastifyInstance) {
	app.get("/v1/auth/google/status", async () => ({
		configured: isGoogleOAuthConfigured(),
	}));

	app.get("/v1/auth/google", async (_request, reply) => {
		if (!isGoogleOAuthConfigured()) {
			throw new ApiError({
				code: "not_configured",
				message: "Google OAuth is not configured on this server.",
				statusCode: 503,
			});
		}

		const state = randomBytes(24).toString("hex");
		reply.setCookie(OAUTH_STATE_COOKIE, state, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			maxAge: 600,
		});

		return reply.redirect(buildGoogleAuthUrl(state));
	});

	app.get<{
		Querystring: { code?: string; state?: string; error?: string };
	}>("/v1/auth/google/callback", async (request, reply) => {
		const fail = (message: string) =>
			reply.redirect(
				getDashboardOAuthRedirectUrl("/auth/google/callback", {
					error: message,
				}),
			);

		if (!isGoogleOAuthConfigured()) {
			return fail("Google OAuth is not configured.");
		}

		const oauthError = request.query.error;
		if (oauthError) {
			return fail(oauthError === "access_denied" ? "access_denied" : oauthError);
		}

		const cookieState = request.cookies[OAUTH_STATE_COOKIE];
		reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

		const { code, state } = request.query;
		if (!code || !state || !cookieState || state !== cookieState) {
			return fail("invalid_state");
		}

		try {
			const token = await exchangeGoogleCode(code);
			const profile = await fetchGoogleUserProfile(token.access_token);
			const user = await findOrCreateGoogleUser(profile);

			const [totpRow] = await db
				.select({ totpSecret: users.totpSecret })
				.from(users)
				.where(eq(users.id, user.id))
				.limit(1);

			const loginStep = await maybeRequire2faForLogin(
				request,
				{
					id: user.id,
					email: user.email!,
					fullName: user.fullName,
					totpSecret: totpRow?.totpSecret ?? null,
				},
				AUDIT_ACTIONS.AUTH_LOGIN_GOOGLE,
			);

			if (loginStep.requires_2fa) {
				const hash = new URLSearchParams({
					requires_2fa: "1",
					pending_token: loginStep.pending_token,
					email: user.email ?? "",
				});
				return reply.redirect(
					`${getDashboardOAuthRedirectUrl("/auth/google/callback")}#${hash.toString()}`,
				);
			}

			const memberships = await ensureDemoWorkspaceMembership(user.id);

			const { access_token: accessToken, refresh_token: refreshToken, session_id: sessionId } =
				loginStep.result;

			const hash = new URLSearchParams({
				access_token: accessToken,
				refresh_token: refreshToken,
				session_id: sessionId,
				user_id: user.id,
				email: user.email ?? "",
				full_name: user.fullName ?? "",
				workspaces: JSON.stringify(
					memberships.map((m) => ({ id: m.workspaceId, role: m.role })),
				),
			});

			return reply.redirect(
				`${getDashboardOAuthRedirectUrl("/auth/google/callback")}#${hash.toString()}`,
			);
		} catch (err) {
			const message =
				err instanceof ApiError
					? err.message
					: "Google sign-in failed.";
			return fail(message.slice(0, 200));
		}
	});
}
