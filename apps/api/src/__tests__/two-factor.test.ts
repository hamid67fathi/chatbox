import { generateSync } from "otplib";
import { describe, expect, it } from "vitest";
import {
	generateTotpSecret,
	isTotpEnabled,
	parseRecoveryHashes,
	verifyTotpCode,
	wrapPendingSecret,
} from "../lib/two-factor.js";
import { parseRequire2fa } from "../lib/workspace-2fa-policy.js";
import { mergeRequire2faSettings } from "../lib/workspace-2fa-policy.js";

describe("two-factor", () => {
	it("detects enabled vs pending secret", () => {
		const secret = generateTotpSecret();
		expect(isTotpEnabled(null)).toBe(false);
		expect(isTotpEnabled(wrapPendingSecret(secret))).toBe(false);
		expect(isTotpEnabled(secret)).toBe(true);
	});

	it("verifies TOTP codes", () => {
		const secret = generateTotpSecret();
		const token = generateSync({ secret });
		expect(verifyTotpCode(secret, token)).toBe(true);
		expect(verifyTotpCode(secret, "000000")).toBe(false);
	});

	it("parses recovery hash JSON", () => {
		expect(parseRecoveryHashes('["a","b"]')).toEqual(["a", "b"]);
		expect(parseRecoveryHashes(null)).toEqual([]);
	});
});

describe("workspace 2FA policy", () => {
	it("parses and merges require_2fa", () => {
		expect(parseRequire2fa({ security: { require_2fa: true } })).toBe(true);
		const merged = mergeRequire2faSettings({}, true);
		expect(parseRequire2fa(merged)).toBe(true);
	});
});
