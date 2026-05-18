import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { SignJWT, jwtVerify } from "jose";
import { comparePassword } from "./auth.js";

const BCRYPT_ROUNDS = 12;
const PENDING_PREFIX = "pending:";
const RECOVERY_COUNT = 10;
const APP_NAME = "ChatBox";

const JWT_SECRET_RAW = process.env.JWT_SECRET ?? "chatbox-dev-secret-change-in-prod";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
const JWT_ISSUER = "chatbox";

export interface TwoFactorPendingPayload {
	sub: string;
	email: string;
	type: "2fa_pending";
}

export function isTotpEnabled(
	totpSecret: string | null | undefined,
): boolean {
	return Boolean(totpSecret && !totpSecret.startsWith(PENDING_PREFIX));
}

export function activeTotpSecret(
	totpSecret: string | null | undefined,
): string | null {
	if (!totpSecret || totpSecret.startsWith(PENDING_PREFIX)) return null;
	return totpSecret;
}

export function pendingTotpSecret(
	totpSecret: string | null | undefined,
): string | null {
	if (!totpSecret?.startsWith(PENDING_PREFIX)) return null;
	return totpSecret.slice(PENDING_PREFIX.length);
}

export function wrapPendingSecret(secret: string): string {
	return `${PENDING_PREFIX}${secret}`;
}

export function generateTotpSecret(): string {
	return generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string): string {
	return generateURI({ issuer: APP_NAME, label: email, secret });
}

export async function qrDataUrlForOtpAuth(otpauthUrl: string): Promise<string> {
	return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

export function verifyTotpCode(secret: string, code: string): boolean {
	const token = code.replace(/\s/g, "");
	if (!/^\d{6}$/.test(token)) return false;
	try {
		return verifySync({ token, secret }).valid === true;
	} catch {
		return false;
	}
}

export async function signTwoFactorPendingToken(
	userId: string,
	email: string,
): Promise<string> {
	return new SignJWT({
		sub: userId,
		email,
		type: "2fa_pending",
	} satisfies TwoFactorPendingPayload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(JWT_ISSUER)
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(JWT_SECRET);
}

export async function verifyTwoFactorPendingToken(
	token: string,
): Promise<TwoFactorPendingPayload> {
	const { payload } = await jwtVerify(token, JWT_SECRET, {
		issuer: JWT_ISSUER,
	});
	const p = payload as unknown as TwoFactorPendingPayload;
	if (p.type !== "2fa_pending" || !p.sub || !p.email) {
		throw new Error("invalid 2fa pending token");
	}
	return p;
}

function randomRecoverySegment(): string {
	return randomBytes(3).toString("hex").toUpperCase();
}

export function formatRecoveryCode(): string {
	return `${randomRecoverySegment()}-${randomRecoverySegment()}`;
}

export async function generateRecoveryCodeHashes(): Promise<{
	plain: string[];
	hashedJson: string;
}> {
	const plain: string[] = [];
	const hashes: string[] = [];
	for (let i = 0; i < RECOVERY_COUNT; i++) {
		const code = formatRecoveryCode();
		plain.push(code);
		hashes.push(await bcrypt.hash(code.replace(/-/g, "").toUpperCase(), BCRYPT_ROUNDS));
	}
	return { plain, hashedJson: JSON.stringify(hashes) };
}

export function parseRecoveryHashes(raw: string | null | undefined): string[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((h): h is string => typeof h === "string");
	} catch {
		return [];
	}
}

export async function verifyRecoveryCode(
	input: string,
	hashes: string[],
): Promise<{ ok: boolean; remainingHashes: string[] }> {
	const normalized = input.replace(/[\s-]/g, "").toUpperCase();
	if (normalized.length < 8) return { ok: false, remainingHashes: hashes };

	for (let i = 0; i < hashes.length; i++) {
		const hash = hashes[i];
		if (await bcrypt.compare(normalized, hash)) {
			const remainingHashes = hashes.filter((_, idx) => idx !== i);
			return { ok: true, remainingHashes };
		}
	}
	return { ok: false, remainingHashes: hashes };
}

export async function verifyTotpOrRecovery(opts: {
	totpSecret: string | null;
	recoveryHashesJson: string | null;
	code?: string;
	recoveryCode?: string;
}): Promise<
	| { ok: true; usedRecovery: boolean; remainingHashes?: string[] }
	| { ok: false }
> {
	const secret = activeTotpSecret(opts.totpSecret);
	if (!secret) return { ok: false };

	if (opts.recoveryCode) {
		const hashes = parseRecoveryHashes(opts.recoveryHashesJson);
		const result = await verifyRecoveryCode(opts.recoveryCode, hashes);
		if (!result.ok) return { ok: false };
		return {
			ok: true,
			usedRecovery: true,
			remainingHashes: result.remainingHashes,
		};
	}

	if (opts.code && verifyTotpCode(secret, opts.code)) {
		return { ok: true, usedRecovery: false };
	}

	return { ok: false };
}

export async function verifyPasswordFor2fa(
	password: string | undefined,
	passwordHash: string | null,
): Promise<boolean> {
	if (!passwordHash) return true;
	if (!password) return false;
	return comparePassword(password, passwordHash);
}
