import { buildApp } from "./app.js";
import { runAgentPerformanceRefresh } from "./lib/agent-performance/refresh.js";
import { startEmailNotificationWorker } from "./lib/email-notifications/queue.js";
import { startWebhookWorker } from "./lib/webhooks/queue.js";
import { runSlaMonitorTick } from "./lib/sla/index.js";
import { setIO } from "./ws/broadcast.js";
import { createSocketServer } from "./ws/index.js";

const SLA_MONITOR_MS = Number(process.env.SLA_MONITOR_MS ?? 5 * 60 * 1000);
const AGENT_PERF_REFRESH_MS = Number(
	process.env.AGENT_PERF_REFRESH_MS ?? 60 * 60 * 1000,
);

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

const start = async () => {
	try {
		await app.listen({ port, host: "0.0.0.0" });
		console.log(`Server listening at http://0.0.0.0:${port}`);

		const httpServer = app.server;
		const io = createSocketServer(httpServer);
		setIO(io);

		console.log("Socket.IO attached to HTTP server");

		if (SLA_MONITOR_MS > 0) {
			setInterval(() => void runSlaMonitorTick(), SLA_MONITOR_MS);
			void runSlaMonitorTick();
		}

		if (AGENT_PERF_REFRESH_MS > 0) {
			setInterval(
				() => void runAgentPerformanceRefresh(),
				AGENT_PERF_REFRESH_MS,
			);
			void runAgentPerformanceRefresh();
		}

		startEmailNotificationWorker();
		startWebhookWorker();
	} catch (err) {
		console.error("Failed to start server:", err);
		process.exit(1);
	}
};

void start();
