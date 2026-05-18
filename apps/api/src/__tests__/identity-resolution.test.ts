import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "../lib/identity-resolution.js";

describe("identity resolution", () => {
	it("normalizes email", () => {
		expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
		expect(normalizeEmail("")).toBeNull();
	});

	it("normalizes phone", () => {
		expect(normalizePhone("+98 912 000 0000")).toBe("+989120000000");
		expect(normalizePhone("   ")).toBeNull();
	});
});
