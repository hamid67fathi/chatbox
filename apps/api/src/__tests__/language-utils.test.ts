import { describe, expect, it } from "vitest";
import { localeToLang } from "../lib/language-utils.js";

describe("localeToLang", () => {
	it("maps workspace locales", () => {
		expect(localeToLang("fa-IR")).toBe("fa");
		expect(localeToLang("en-US")).toBe("en");
		expect(localeToLang("ar-SA")).toBe("ar");
		expect(localeToLang(null)).toBe("fa");
	});
});
