import { describe, expect, it } from "vitest";
import { parseNotificationPreferences } from "../lib/notification-preferences.js";

describe("browser notification prefs", () => {
	it("defaults browser flags on", () => {
		const p = parseNotificationPreferences({});
		expect(p.browser_enabled).toBe(true);
		expect(p.browser_new_message).toBe(true);
		expect(p.browser_needs_human).toBe(true);
	});

	it("merges browser patch", () => {
		const p = parseNotificationPreferences({
			browser_enabled: true,
			browser_new_message: false,
		});
		expect(p.browser_new_message).toBe(false);
		expect(p.browser_new_conversation).toBe(true);
	});
});
