import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db } from "./db/index.js";
import { errorHandler } from "./lib/errors.js";
import { contactRoutes } from "./routes/contacts.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { widgetRoutes } from "./routes/widget.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { setIO } from "./ws/broadcast.js";
import { createSocketServer } from "./ws/index.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3001);

app.register(cors, { origin: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const widgetRoot = resolve(__dirname, "../../widget");
app.register(fastifyStatic, {
	root: widgetRoot,
	prefix: "/widget-demo/",
	decorateReply: false,
});
app.register(fastifyStatic, {
	root: resolve(widgetRoot, "dist"),
	prefix: "/widget-demo/dist/",
	decorateReply: false,
});

app.setErrorHandler(errorHandler);

app.get("/health", async () => {
	const result = await db.execute(sql`SELECT 1 AS ok`);
	return { ok: true, db: result.length > 0 };
});

app.register(workspaceRoutes);
app.register(contactRoutes);
app.register(conversationRoutes);
app.register(messageRoutes);
app.register(widgetRoutes);

const start = async () => {
	try {
		await app.listen({ port, host: "0.0.0.0" });

		const httpServer = app.server;
		const io = createSocketServer(httpServer);
		setIO(io);

		app.log.info("Socket.IO attached to HTTP server");
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

void start();
