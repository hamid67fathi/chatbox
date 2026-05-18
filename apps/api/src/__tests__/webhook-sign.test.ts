import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../lib/webhooks/sign.js";

describe("webhook HMAC", () => {
	it("signs and verifies payload", () => {
		const secret = "test-secret";
		const body = JSON.stringify({ type: "conversation.created" });
		const sig = signWebhookPayload(secret, body);
		expect(sig.startsWith("sha256=")).toBe(true);
		expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
		expect(verifyWebhookSignature(secret, body, "sha256=invalid")).toBe(
			false,
		);
	});
});
