import bcrypt from "bcrypt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "./errors.js";

const BCRYPT_ROUNDS = 12;

const JWT_SECRET_RAW = process.env.JWT_SECRET ?? "chatbox-dev-secret-change-in-prod";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
const JWT_ISSUER = "chatbox";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const VISITOR_TOKEN_EXPIRY = "24h";

export interface AccessTokenPayload {
	sub: string;
	email: string;
	type: "access";
}

export interface RefreshTokenPayload {
	sub: string;
	sid: string;
	type: "refresh";
}

export interface VisitorTokenPayload {
	sub: string;
	wid: string;
	cid: string;
	type: "visitor";
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export async function signAccessToken(
	userId: string,
	email: string,
): Promise<string> {
	return new SignJWT({ sub: userId, email, type: "access" } satisfies AccessTokenPayload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(JWT_ISSUER)
		.setIssuedAt()
		.setExpirationTime(ACCESS_TOKEN_EXPIRY)
		.sign(JWT_SECRET);
}

export async function signRefreshToken(
	userId: string,
	sessionId: string,
): Promise<string> {
	return new SignJWT({ sub: userId, sid: sessionId, type: "refresh" } satisfies RefreshTokenPayload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(JWT_ISSUER)
		.setIssuedAt()
		.setExpirationTime(REFRESH_TOKEN_EXPIRY)
		.sign(JWT_SECRET);
}

export async function signVisitorToken(
	contactId: string,
	workspaceId: string,
	conversationId: string,
): Promise<string> {
	return new SignJWT({
		sub: contactId,
		wid: workspaceId,
		cid: conversationId,
		type: "visitor",
	} satisfies VisitorTokenPayload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(JWT_ISSUER)
		.setIssuedAt()
		.setExpirationTime(VISITOR_TOKEN_EXPIRY)
		.sign(JWT_SECRET);
}

export async function verifyToken<T>(token: string): Promise<T> {
	const { payload } = await jwtVerify(token, JWT_SECRET, {
		issuer: JWT_ISSUER,
	});
	return payload as T;
}

export function unauthorized(message = "Authentication required.") {
	return new ApiError({
		code: "unauthorized",
		message,
		statusCode: 401,
	});
}

export function forbidden(message = "Insufficient permissions.") {
	return new ApiError({
		code: "forbidden",
		message,
		statusCode: 403,
	});
}

export async function requireAuth(
	request: FastifyRequest,
	_reply: FastifyReply,
): Promise<void> {
	const header = request.headers.authorization;
	if (!header?.startsWith("Bearer ")) {
		throw unauthorized();
	}

	const token = header.slice(7);
	try {
		const payload = await verifyToken<AccessTokenPayload>(token);
		if (payload.type !== "access") throw unauthorized("Invalid token type.");
		(request as AuthenticatedRequest).user = {
			id: payload.sub,
			email: payload.email,
		};
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw unauthorized("Invalid or expired token.");
	}
}

export interface AuthenticatedRequest extends FastifyRequest {
	user: { id: string; email: string };
}
