import { describe, expect, it } from "vitest";
import {
	mergeWhatsappIntegration,
	normalizeWhatsappPhone,
	parseWhatsappIntegration,
	whatsappWebhookUrl,
} from "../lib/whatsapp-settings.js";

describe("whatsapp-settings", () => {
	it("parses whatsapp integration", () => {
		const config = parseWhatsappIntegration({
			integrations: {
				whatsapp: {
					enabled: true,
					phone_number_id: "123",
					access_token: "token",
					verify_token: "verify",
					display_phone_number: "+989121234567",
					connected_at: "2026-05-16T00:00:00.000Z",
				},
			},
		});
		expect(config?.phone_number_id).toBe("123");
	});

	it("normalizes phone digits", () => {
		expect(normalizeWhatsappPhone("+98 912 123 4567")).toBe("989121234567");
	});

	it("merges and clears", () => {
		const withWa = mergeWhatsappIntegration({}, {
			enabled: true,
			phone_number_id: "1",
			access_token: "t",
			verify_token: "v",
			display_phone_number: null,
			connected_at: "2026-05-16T00:00:00.000Z",
		});
		expect(parseWhatsappIntegration(withWa)?.access_token).toBe("t");
		const cleared = mergeWhatsappIntegration(withWa, null);
		expect(parseWhatsappIntegration(cleared)).toBeNull();
	});

	it("builds webhook url", () => {
		process.env.API_PUBLIC_URL = "https://api.example.com";
		expect(whatsappWebhookUrl("ws-1")).toContain(
			"/v1/integrations/whatsapp/webhook/ws-1",
		);
	});
});
