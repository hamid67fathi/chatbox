import { describe, expect, it } from "vitest";
import {
	banMetadataPatch,
	isContactBanned,
	unbanMetadataPatch,
} from "../lib/contact-ban.js";

describe("contact-ban", () => {
	it("detects banned metadata", () => {
		expect(isContactBanned({})).toBe(false);
		expect(isContactBanned({ bannedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
	});

	it("patches ban and unban metadata", () => {
		const banned = banMetadataPatch({ visitor: { ip: "1.2.3.4" } }, "user-1", "spam");
		expect(isContactBanned(banned)).toBe(true);
		expect(banned.bannedBy).toBe("user-1");
		expect(banned.banReason).toBe("spam");
		expect((banned as { visitor?: { ip: string } }).visitor?.ip).toBe("1.2.3.4");

		const cleared = unbanMetadataPatch(banned);
		expect(isContactBanned(cleared)).toBe(false);
		expect(cleared.bannedBy).toBeUndefined();
	});
});
