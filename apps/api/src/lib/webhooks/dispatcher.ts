import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { webhookDeliveries, webhookEndpoints } from "../../db/schema/index.js";
import { enqueueWebhookDelivery } from "./queue.js";
import type { WebhookEventType } from "./types.js";

export function buildWebhookEnvelope(
	workspaceId: string,
	event: WebhookEventType,
	data: Record<string, unknown>,
) {
	return {
		id: randomUUID(),
		type: event,
		created_at: new Date().toISOString(),
		workspace_id: workspaceId,
		data,
	};
}

export async function dispatchWebhookEvent(
	workspaceId: string,
	event: WebhookEventType,
	data: Record<string, unknown>,
): Promise<void> {
	const endpoints = await db.query.webhookEndpoints.findMany({
		where: and(
			eq(webhookEndpoints.workspaceId, workspaceId),
			eq(webhookEndpoints.enabled, true),
		),
	});

	const payload = buildWebhookEnvelope(workspaceId, event, data);

	for (const ep of endpoints) {
		if (!ep.events.includes(event)) continue;

		const [delivery] = await db
			.insert(webhookDeliveries)
			.values({
				endpointId: ep.id,
				workspaceId,
				event,
				payload,
				status: "pending",
			})
			.returning();

		if (!delivery) continue;

		void enqueueWebhookDelivery({
			deliveryId: delivery.id,
			endpointId: ep.id,
			workspaceId,
			url: ep.url,
			secret: ep.secret,
			event,
			payload: payload as Record<string, unknown>,
		}).catch(async (err) => {
			await db
				.update(webhookDeliveries)
				.set({
					status: "failed",
					error: err instanceof Error ? err.message : "Enqueue failed",
				})
				.where(eq(webhookDeliveries.id, delivery.id));
		});
	}
}
