import { describe, expect, it } from "vitest";
import {
	isIpAllowedByRules,
	parseDashboardIpWhitelist,
} from "../lib/ip-ban.js";

describe("dashboard IP whitelist", () => {
	it("parses whitelist from settings", () => {
		expect(
			parseDashboardIpWhitelist({
				security: { dashboard_ip_whitelist: ["1.2.3.4"] },
			}),
		).toEqual(["1.2.3.4"]);
	});

	it("allows all when empty", () => {
		expect(isIpAllowedByRules("8.8.8.8", [])).toBe(true);
	});

	it("blocks IP not in whitelist", () => {
		const rules = ["192.168.1.*"];
		expect(isIpAllowedByRules("192.168.1.5", rules)).toBe(true);
		expect(isIpAllowedByRules("8.8.8.8", rules)).toBe(false);
	});
});
