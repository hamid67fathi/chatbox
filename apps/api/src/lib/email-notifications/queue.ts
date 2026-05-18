import { Queue, Worker } from "bullmq";
import type { EmailNotificationJob } from "./types.js";
import { processEmailNotificationJob } from "./worker.js";

const QUEUE_NAME = "email-notifications";

let queue: Queue<EmailNotificationJob> | null = null;
let worker: Worker<EmailNotificationJob> | null = null;

function redisConnection() {
	const url = process.env.REDIS_URL ?? "redis://localhost:6379";
	return { url };
}

export function getEmailNotificationQueue(): Queue<EmailNotificationJob> | null {
	if (!process.env.REDIS_URL) return null;
	if (!queue) {
		queue = new Queue<EmailNotificationJob>(QUEUE_NAME, {
			connection: redisConnection(),
			defaultJobOptions: {
				attempts: 4,
				backoff: { type: "exponential", delay: 5000 },
				removeOnComplete: 200,
				removeOnFail: 500,
			},
		});
	}
	return queue;
}

export async function enqueueEmailNotification(
	job: EmailNotificationJob,
): Promise<void> {
	const q = getEmailNotificationQueue();
	if (q) {
		await q.add(job.kind, job);
		return;
	}
	// Fallback when Redis unavailable (dev)
	await processEmailNotificationJob(job);
}

export function startEmailNotificationWorker(): void {
	if (!process.env.REDIS_URL || worker) return;
	worker = new Worker<EmailNotificationJob>(
		QUEUE_NAME,
		async (job) => {
			await processEmailNotificationJob(job.data);
		},
		{ connection: redisConnection(), concurrency: 3 },
	);
	worker.on("failed", (job, err) => {
		console.error(
			`[email-notifications] job ${job?.id} failed:`,
			err.message,
		);
	});
	console.log("[email-notifications] BullMQ worker started");
}
