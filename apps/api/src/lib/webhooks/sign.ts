import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookPayload(secret: string, body: string): string {
	const hmac = createHmac("sha256", secret).update(body, "utf8").digest("hex");
	return `sha256=${hmac}`;
}

export function verifyWebhookSignature(
	secret: string,
	body: string,
	signatureHeader: string | undefined,
): boolean {
	if (!signatureHeader?.startsWith("sha256=")) return false;
	const expected = signWebhookPayload(secret, body);
	try {
		return timingSafeEqual(
			Buffer.from(expected),
			Buffer.from(signatureHeader),
		);
	} catch {
		return false;
	}
}
