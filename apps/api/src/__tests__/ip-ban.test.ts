import { describe, expect, it } from "vitest";
import { isIpBanned, normalizeBanRule, parseBannedIps } from "../lib/ip-ban.js";

describe("ip-ban", () => {
	it("parses banned IPs from workspace settings", () => {
		const list = parseBannedIps({
			security: { banned_ips: ["1.2.3.4", "10.0.0.0/8"] },
		});
		expect(list).toEqual(["1.2.3.4", "10.0.0.0/8"]);
	});

	it("matches exact, wildcard, and CIDR rules", () => {
		const rules = ["1.2.3.4", "192.168.1.*", "10.0.0.0/8"];
		expect(isIpBanned("1.2.3.4", rules)).toBe(true);
		expect(isIpBanned("1.2.3.5", rules)).toBe(false);
		expect(isIpBanned("192.168.1.99", rules)).toBe(true);
		expect(isIpBanned("10.1.2.3", rules)).toBe(true);
		expect(isIpBanned("11.0.0.1", rules)).toBe(false);
	});

	it("normalizes valid rules", () => {
		expect(normalizeBanRule(" 1.2.3.4 ")).toBe("1.2.3.4");
		expect(normalizeBanRule("bad")).toBeNull();
	});
});
