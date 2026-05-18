import { describe, expect, it } from "vitest";
import { isValidWebhookUrl } from "../lib/webhooks/parse.js";

describe("plugin marketplace install", () => {
	it("accepts HTTPS webhook URLs for Zapier/Make", () => {
		expect(isValidWebhookUrl("https://hooks.zapier.com/hooks/catch/123/abc/")).toBe(
			true,
		);
		expect(
			isValidWebhookUrl("https://hook.eu2.make.com/abcdefghijklmnop"),
		).toBe(true);
	});

	it("rejects invalid URLs", () => {
		expect(isValidWebhookUrl("not-a-url")).toBe(false);
	});
});
