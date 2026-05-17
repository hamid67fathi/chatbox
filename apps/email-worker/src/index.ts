import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const { pollAllWorkspaceEmails } = await import(
	"../../api/src/channels/email/poller.js"
);

const intervalMs = Number(process.env.EMAIL_POLL_INTERVAL_MS ?? 60_000);

console.log(`[email-worker] polling every ${intervalMs}ms`);

async function tick() {
	try {
		await pollAllWorkspaceEmails();
	} catch (err) {
		console.error("[email-worker] poll cycle failed:", err);
	}
}

void tick();
setInterval(() => void tick(), intervalMs);
