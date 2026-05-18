import { describe, expect, it } from "vitest";
import {
	mergeNotificationPreferences,
	parseNotificationPreferences,
} from "../lib/notification-preferences.js";

describe("notification preferences", () => {
	it("parses defaults", () => {
		expect(parseNotificationPreferences(null)).toEqual({
			push_enabled: true,
			new_conversation: true,
			new_message: true,
			email_enabled: true,
			email_new_conversation: true,
			email_assigned: true,
			email_mention: true,
			sound_enabled: true,
			sound_id: "default",
			sound_when_hidden: false,
			browser_enabled: true,
			browser_new_conversation: true,
			browser_new_message: true,
			browser_needs_human: true,
		});
	});

	it("merges patch", () => {
		const merged = mergeNotificationPreferences(
			{ push_enabled: true, new_conversation: true, new_message: true },
			{ new_message: false },
		);
		expect(merged.new_message).toBe(false);
		expect(merged.push_enabled).toBe(true);
	});
});
