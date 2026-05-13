import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db } from "./db/index.js";
import { errorHandler } from "./lib/errors.js";
import { contactRoutes } from "./routes/contacts.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { workspaceRoutes } from "./routes/workspaces.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3001);

app.setErrorHandler(errorHandler);

app.get("/health", async () => {
	const result = await db.execute(sql`SELECT 1 AS ok`);
	return { ok: true, db: result.length > 0 };
});

app.register(workspaceRoutes);
app.register(contactRoutes);
app.register(conversationRoutes);
app.register(messageRoutes);

const start = async () => {
	try {
		await app.listen({ port, host: "0.0.0.0" });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

void start();
