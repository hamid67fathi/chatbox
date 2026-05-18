import { describe, expect, it } from "vitest";
import { isValidWebhookUrl, parseWebhookEvents } from "../lib/webhooks/parse.js";

describe("webhook parse", () => {
	it("parses events", () => {
		expect(parseWebhookEvents(["conversation.created", "invalid"])).toEqual([
			"conversation.created",
		]);
	});

	it("validates urls", () => {
		expect(isValidWebhookUrl("https://hooks.example.com/cb")).toBe(true);
		expect(isValidWebhookUrl("not-a-url")).toBe(false);
	});
});
