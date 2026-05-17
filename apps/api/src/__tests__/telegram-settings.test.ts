import { describe, expect, it } from "vitest";
import {
	maskBotToken,
	mergeTelegramIntegration,
	parseTelegramIntegration,
	telegramWebhookUrl,
} from "../lib/telegram-settings.js";

describe("telegram-settings", () => {
	it("parses telegram integration from workspace settings", () => {
		const config = parseTelegramIntegration({
			integrations: {
				telegram: {
					enabled: true,
					bot_token: "123:ABC",
					bot_id: 99,
					bot_username: "mybot",
					webhook_secret: "secret",
					connected_at: "2026-05-16T00:00:00.000Z",
				},
			},
		});
		expect(config?.bot_username).toBe("mybot");
		expect(config?.bot_id).toBe(99);
	});

	it("merges and removes telegram integration", () => {
		const withTg = mergeTelegramIntegration({}, {
			enabled: true,
			bot_token: "1:2",
			bot_id: 1,
			bot_username: "b",
			webhook_secret: "s",
			connected_at: "2026-05-16T00:00:00.000Z",
		});
		expect(parseTelegramIntegration(withTg)?.bot_token).toBe("1:2");

		const cleared = mergeTelegramIntegration(withTg, null);
		expect(parseTelegramIntegration(cleared)).toBeNull();
	});

	it("masks bot token", () => {
		expect(maskBotToken("1234567890:ABCDEFghijklmnop")).toMatch(/…/);
	});

	it("builds webhook url", () => {
		process.env.API_PUBLIC_URL = "https://api.example.com";
		expect(telegramWebhookUrl("ws-1")).toBe(
			"https://api.example.com/v1/integrations/telegram/webhook/ws-1",
		);
	});
});
