import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { webhookDeliveries } from "../../db/schema/index.js";
import { signWebhookPayload } from "./sign.js";
import type { WebhookDispatchJob } from "./types.js";

const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS ?? 15_000);

export async function processWebhookDelivery(
	job: WebhookDispatchJob,
	attempt = 1,
): Promise<void> {
	const body = JSON.stringify(job.payload);
	const signature = signWebhookPayload(job.secret, body);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	let httpStatus: number | null = null;
	let responseBody: string | null = null;
	let error: string | null = null;
	let status: "success" | "failed" = "failed";

	try {
		const res = await fetch(job.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "ChatBox-Webhooks/1.0",
				"X-ChatBox-Event": job.event,
				"X-ChatBox-Signature": signature,
				"X-ChatBox-Delivery": job.deliveryId,
			},
			body,
			signal: controller.signal,
		});
		httpStatus = res.status;
		responseBody = (await res.text()).slice(0, 4000);
		if (res.ok) {
			status = "success";
		} else {
			error = `HTTP ${res.status}`;
		}
	} catch (e) {
		error = e instanceof Error ? e.message : "Request failed";
	} finally {
		clearTimeout(timeout);
	}

	await db
		.update(webhookDeliveries)
		.set({
			status,
			httpStatus,
			responseBody,
			error,
			attempts: attempt,
			deliveredAt: status === "success" ? new Date() : null,
		})
		.where(eq(webhookDeliveries.id, job.deliveryId));

	if (status === "failed") {
		throw new Error(error ?? "Webhook delivery failed");
	}
}
