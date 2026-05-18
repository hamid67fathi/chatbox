import { describe, expect, it } from "vitest";
import { mergeCsatSettings, parseCsatSettings } from "../lib/csat-settings.js";

describe("csat-settings", () => {
	it("parses csat from workspace settings", () => {
		const s = parseCsatSettings({
			csat: {
				enabled: true,
				prompt_message: "Rate us",
				ask_comment: false,
			},
		});
		expect(s.enabled).toBe(true);
		expect(s.prompt_message).toBe("Rate us");
		expect(s.ask_comment).toBe(false);
	});

	it("merges csat patch", () => {
		const merged = mergeCsatSettings({}, { enabled: false });
		expect(parseCsatSettings(merged).enabled).toBe(false);
	});
});
