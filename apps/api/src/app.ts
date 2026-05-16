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
import { getWidgetBundleJs } from "./lib/widget-bundle.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { contactRoutes } from "./routes/contacts.js";
import { cannedResponseRoutes } from "./routes/canned-responses.js";
import { knowledgeRoutes } from "./routes/knowledge.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { widgetRoutes } from "./routes/widget.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { widgetConfigRoutes } from "./routes/widget-config.js";

export function buildApp() {
	const app = Fastify({ logger: false });

	app.register(cors, {
		origin: true,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});
	app.register(cookie);
	app.register(helmet, {
		contentSecurityPolicy: false,
		crossOriginOpenerPolicy: false,
		crossOriginEmbedderPolicy: false,
		originAgentCluster: false,
	});
	app.register(rateLimit, {
		global: false,
	});

	const __dirname = dirname(fileURLToPath(import.meta.url));

	app.get("/widget-demo/dist/index.global.js", async (_request, reply) => {
		try {
			const js = await getWidgetBundleJs();
			return reply
				.header("Cache-Control", "public, max-age=60")
				.type("application/javascript; charset=utf-8")
				.send(js);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return reply
				.status(500)
				.type("application/javascript; charset=utf-8")
				.send(
					`console.error("[ChatBox] Widget bundle failed: ${msg.replace(/"/g, '\\"')}");`,
				);
		}
	});

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
		instance.register(widgetConfigRoutes);
		instance.register(contactRoutes);
		instance.register(conversationRoutes);
		instance.register(messageRoutes);
		instance.register(cannedResponseRoutes);
		instance.register(knowledgeRoutes);
		instance.register(billingRoutes);
	});

	return app;
}
