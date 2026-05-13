import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db } from "./db/index.js";
import { requireAuth } from "./lib/auth.js";
import { errorHandler } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { contactRoutes } from "./routes/contacts.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { widgetRoutes } from "./routes/widget.js";
import { workspaceRoutes } from "./routes/workspaces.js";

export function buildApp() {
	const app = Fastify({ logger: false });

	app.register(cors, { origin: true, credentials: true });
	app.register(cookie);
	app.register(helmet, { contentSecurityPolicy: false });
	app.register(rateLimit, {
		global: false,
	});

	const __dirname = dirname(fileURLToPath(import.meta.url));

	const publicRoot = resolve(__dirname, "../public");
	app.register(fastifyStatic, {
		root: publicRoot,
		prefix: "/",
		decorateReply: false,
	});

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

	app.register(authRoutes);
	app.register(widgetRoutes);

	app.register(async function protectedRoutes(instance) {
		instance.addHook("onRequest", requireAuth);

		instance.register(workspaceRoutes);
		instance.register(contactRoutes);
		instance.register(conversationRoutes);
		instance.register(messageRoutes);
		instance.register(billingRoutes);
	});

	return app;
}
