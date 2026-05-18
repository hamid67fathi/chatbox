import { Queue, Worker } from "bullmq";
import type { WebhookDispatchJob } from "./types.js";
import { processWebhookDelivery } from "./worker.js";

const QUEUE_NAME = "webhook-outbound";

let queue: Queue<WebhookDispatchJob> | null = null;
let worker: Worker<WebhookDispatchJob> | null = null;

function redisConnection() {
	const url = process.env.REDIS_URL ?? "redis://localhost:6379";
	return { url };
}

export function getWebhookQueue(): Queue<WebhookDispatchJob> | null {
	if (!process.env.REDIS_URL) return null;
	if (!queue) {
		queue = new Queue<WebhookDispatchJob>(QUEUE_NAME, {
			connection: redisConnection(),
			defaultJobOptions: {
				attempts: 5,
				backoff: { type: "exponential", delay: 3000 },
				removeOnComplete: 300,
				removeOnFail: 1000,
			},
		});
	}
	return queue;
}

export async function enqueueWebhookDelivery(
	job: WebhookDispatchJob,
): Promise<void> {
	const q = getWebhookQueue();
	if (q) {
		await q.add(job.event, job, { jobId: job.deliveryId });
		return;
	}
	await processWebhookDelivery(job);
}

export function startWebhookWorker(): void {
	if (!process.env.REDIS_URL || worker) return;
	worker = new Worker<WebhookDispatchJob>(
		QUEUE_NAME,
		async (job) => {
			await processWebhookDelivery(job.data, job.attemptsMade + 1);
		},
		{ connection: redisConnection(), concurrency: 5 },
	);
	worker.on("failed", (job, err) => {
		console.error(`[webhook-outbound] job ${job?.id} failed:`, err.message);
	});
	console.log("[webhook-outbound] BullMQ worker started");
}
