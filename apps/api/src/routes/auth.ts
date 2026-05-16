import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import {
	sessions,
	users,
	workspaceMembers,
	workspaces,
} from "../db/schema/index.js";
import {
	type AuthenticatedRequest,
	type RefreshTokenPayload,
	comparePassword,
	hashPassword,
	requireAuth,
	signAccessToken,
	signRefreshToken,
	unauthorized,
	verifyToken,
} from "../lib/auth.js";
import { ApiError, validationError } from "../lib/errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFRESH_DAYS = 7;

export async function authRoutes(app: FastifyInstance) {
	app.post<{
		Body: { email: string; password: string; fullName?: string };
	}>("/v1/auth/register", async (request, reply) => {
		const { email, password, fullName } = request.body ?? {};
		if (!email || !EMAIL_RE.test(email))
			throw validationError("A valid email is required.", "email");
		if (!password || password.length < 8)
			throw validationError("Password must be at least 8 characters.", "password");

		const existing = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (existing.length > 0)
			throw new ApiError({ code: "conflict", message: "Email already registered.", statusCode: 409 });

		const hashed = await hashPassword(password);

		const [user] = await db
			.insert(users)
			.values({
				email: email.toLowerCase(),
				passwordHash: hashed,
				fullName: fullName ?? null,
				emailVerified: false,
			})
			.returning({ id: users.id, email: users.email });

		const accessToken = await signAccessToken(user.id, user.email!);
		const { refreshToken, sessionId } = await createSession(
			user.id,
			request.headers["user-agent"],
			request.ip,
		);

		const memberships = await ensureDemoWorkspaceMembership(user.id);

		return reply.status(201).send({
			access_token: accessToken,
			refresh_token: refreshToken,
			session_id: sessionId,
			user: {
				id: user.id,
				email: user.email,
				workspaces: memberships.map((m) => ({
					id: m.workspaceId,
					role: m.role,
				})),
			},
		});
	});

	app.post<{
		Body: { email: string; password: string };
	}>("/v1/auth/login", async (request, reply) => {
		const { email, password } = request.body ?? {};
		if (!email || !password)
			throw validationError("Email and password are required.");

		const [user] = await db
			.select({
				id: users.id,
				email: users.email,
				passwordHash: users.passwordHash,
				fullName: users.fullName,
			})
			.from(users)
			.where(eq(users.email, email.toLowerCase()))
			.limit(1);

		if (!user || !user.passwordHash)
			throw unauthorized("Invalid email or password.");

		const valid = await comparePassword(password, user.passwordHash);
		if (!valid) throw unauthorized("Invalid email or password.");

		await db
			.update(users)
			.set({ lastLoginAt: new Date() })
			.where(eq(users.id, user.id));

		const accessToken = await signAccessToken(user.id, user.email!);
		const { refreshToken, sessionId } = await createSession(
			user.id,
			request.headers["user-agent"],
			request.ip,
		);

		const memberships = await ensureDemoWorkspaceMembership(user.id);

		return reply.send({
			access_token: accessToken,
			refresh_token: refreshToken,
			session_id: sessionId,
			user: {
				id: user.id,
				email: user.email,
				full_name: user.fullName,
				workspaces: memberships.map((m) => ({
					id: m.workspaceId,
					role: m.role,
				})),
			},
		});
	});

	app.post<{
		Body: { refresh_token: string };
	}>("/v1/auth/refresh", async (request, reply) => {
		const { refresh_token: rt } = request.body ?? {};
		if (!rt) throw validationError("refresh_token is required.");

		let payload: RefreshTokenPayload;
		try {
			payload = await verifyToken<RefreshTokenPayload>(rt);
			if (payload.type !== "refresh") throw new Error("wrong type");
		} catch {
			throw unauthorized("Invalid or expired refresh token.");
		}

		const [session] = await db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.id, payload.sid),
					eq(sessions.refreshToken, rt),
					gt(sessions.expiresAt, new Date()),
				),
			)
			.limit(1);

		if (!session) throw unauthorized("Session expired or revoked.");

		const [user] = await db
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.id, session.userId))
			.limit(1);

		if (!user) throw unauthorized("User not found.");

		const newRefresh = randomBytes(48).toString("base64url");
		const newExpires = new Date(Date.now() + REFRESH_DAYS * 86400_000);

		await db
			.update(sessions)
			.set({ refreshToken: newRefresh, expiresAt: newExpires })
			.where(eq(sessions.id, session.id));

		const accessToken = await signAccessToken(user.id, user.email!);
		const refreshToken = await signRefreshToken(user.id, session.id);

		return reply.send({
			access_token: accessToken,
			refresh_token: refreshToken,
		});
	});

	app.post(
		"/v1/auth/logout",
		{ preHandler: [requireAuth] },
		async (request, reply) => {
			const userId = (request as AuthenticatedRequest).user.id;
			const body = request.body as { session_id?: string } | undefined;

			if (body?.session_id) {
				await db
					.delete(sessions)
					.where(
						and(eq(sessions.id, body.session_id), eq(sessions.userId, userId)),
					);
			} else {
				await db.delete(sessions).where(eq(sessions.userId, userId));
			}

			return reply.send({ ok: true });
		},
	);

	app.get(
		"/v1/auth/me",
		{ preHandler: [requireAuth] },
		async (request, reply) => {
			const { id } = (request as AuthenticatedRequest).user;

			const [user] = await db
				.select({
					id: users.id,
					email: users.email,
					fullName: users.fullName,
					avatarUrl: users.avatarUrl,
					locale: users.locale,
					createdAt: users.createdAt,
				})
				.from(users)
				.where(eq(users.id, id))
				.limit(1);

			if (!user) throw unauthorized("User not found.");

			const memberships = await ensureDemoWorkspaceMembership(id);

			return reply.send({
				user: {
					id: user.id,
					email: user.email,
					full_name: user.fullName,
					avatar_url: user.avatarUrl,
					locale: user.locale,
					created_at: user.createdAt,
					workspaces: memberships.map((m) => ({
						id: m.workspaceId,
						role: m.role,
					})),
				},
			});
		},
	);

	app.patch<{
		Body: {
			full_name?: string;
			locale?: string;
			current_password?: string;
			new_password?: string;
		};
	}>(
		"/v1/auth/me",
		{ preHandler: [requireAuth] },
		async (request, reply) => {
			const authUser = (request as AuthenticatedRequest).user;
			const { full_name, locale, current_password, new_password } =
				request.body ?? {};

			const [existing] = await db
				.select({
					id: users.id,
					email: users.email,
					passwordHash: users.passwordHash,
				})
				.from(users)
				.where(eq(users.id, authUser.id))
				.limit(1);

			if (!existing) throw unauthorized("User not found.");

			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (full_name !== undefined) updates.fullName = full_name.trim() || null;
			if (locale !== undefined) updates.locale = locale.trim() || "fa-IR";

			if (new_password) {
				if (new_password.length < 8) {
					throw validationError(
						"New password must be at least 8 characters.",
						"new_password",
					);
				}
				if (!existing.passwordHash) {
					throw validationError(
						"Set a password via registration first.",
						"new_password",
					);
				}
				if (!current_password) {
					throw validationError(
						"current_password is required to change password.",
						"current_password",
					);
				}
				const ok = await comparePassword(current_password, existing.passwordHash);
				if (!ok) {
					throw validationError("Current password is incorrect.", "current_password");
				}
				updates.passwordHash = await hashPassword(new_password);
			}

			if (Object.keys(updates).length === 1) {
				throw validationError("No valid fields to update.");
			}

			const [user] = await db
				.update(users)
				.set(updates)
				.where(eq(users.id, authUser.id))
				.returning({
					id: users.id,
					email: users.email,
					fullName: users.fullName,
					locale: users.locale,
				});

			return reply.send({
				user: {
					id: user.id,
					email: user.email,
					full_name: user.fullName,
					locale: user.locale,
				},
			});
		},
	);
}

async function loadUserWorkspaces(userId: string) {
	return db
		.select({
			workspaceId: workspaceMembers.workspaceId,
			role: workspaceMembers.role,
		})
		.from(workspaceMembers)
		.where(eq(workspaceMembers.userId, userId));
}

/** Ensures dev users can access the demo workspace inbox. */
async function ensureDemoWorkspaceMembership(userId: string) {
	let memberships = await loadUserWorkspaces(userId);
	if (memberships.length > 0) return memberships;

	const demo = await db.query.workspaces.findFirst({
		where: eq(workspaces.slug, "demo"),
	});
	if (!demo) return memberships;

	await db
		.insert(workspaceMembers)
		.values({
			workspaceId: demo.id,
			userId,
			role: "agent",
			status: "active",
			joinedAt: new Date(),
		})
		.onConflictDoNothing();

	memberships = await loadUserWorkspaces(userId);
	return memberships;
}

async function createSession(
	userId: string,
	userAgent?: string,
	ip?: string,
): Promise<{ refreshToken: string; sessionId: string }> {
	const refreshToken = randomBytes(48).toString("base64url");
	const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400_000);

	const [session] = await db
		.insert(sessions)
		.values({
			userId,
			refreshToken,
			userAgent: userAgent ?? null,
			ipAddress: ip ?? null,
			expiresAt,
		})
		.returning({ id: sessions.id });

	return { refreshToken, sessionId: session.id };
}
