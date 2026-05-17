import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db } from "./db/index.js";
import { requireAuth } from "./lib/auth.js";
import { errorHandler } from "./lib/errors.js";
import { getWidgetBundleJs } from "./lib/widget-bundle.js";
import { UPLOAD_ROOT } from "./lib/uploads.js";
import { authRoutes } from "./routes/auth.js";
import { billingPublicRoutes } from "./routes/billing-public.js";
import { billingRoutes } from "./routes/billing.js";
import { contactRoutes } from "./routes/contacts.js";
import { cannedResponseRoutes } from "./routes/canned-responses.js";
import { copilotRoutes } from "./routes/copilot.js";
import { knowledgeRoutes } from "./routes/knowledge.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { uploadRoutes } from "./routes/uploads.js";
import { widgetRoutes } from "./routes/widget.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { widgetConfigRoutes } from "./routes/widget-config.js";
import { apiTokenRoutes } from "./routes/api-tokens.js";
import { reportRoutes } from "./routes/reports.js";
import { securityRoutes } from "./routes/security.js";
import {
	integrationsProtectedRoutes,
	integrationsRoutes,
} from "./routes/integrations.js";

export function buildApp() {
	const app = Fastify({ logger: false, trustProxy: true });

	app.register(cors, {
		origin: true,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Workspace-Id",
			"Accept",
			"Cache-Control",
		],
		exposedHeaders: ["Content-Type"],
	});
	app.register(cookie);
	app.register(helmet, {
		contentSecurityPolicy: false,
		crossOriginOpenerPolicy: false,
		crossOriginEmbedderPolicy: false,
		crossOriginResourcePolicy: { policy: "cross-origin" },
		originAgentCluster: false,
	});
	app.register(rateLimit, {
		global: false,
	});
	app.register(multipart, {
		limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024) },
	});

	const __dirname = dirname(fileURLToPath(import.meta.url));

	app.register(fastifyStatic, {
		root: UPLOAD_ROOT,
		prefix: "/uploads/",
		decorateReply: false,
		setHeaders(res) {
			res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
			res.setHeader("Access-Control-Allow-Origin", "*");
		},
	});

	app.get("/widget-demo/dist/index.global.js", async (_request, reply) => {
		try {
			const js = await getWidgetBundleJs();
			const cacheControl =
				process.env.NODE_ENV === "production"
					? "public, max-age=60"
					: "no-store";
			return reply
				.header("Cache-Control", cacheControl)
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
		setHeaders(res, path) {
			if (typeof path === "string" && path.replace(/\\/g, "/").includes("/fonts/")) {
				res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
				res.setHeader("Access-Control-Allow-Origin", "*");
			}
		},
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
	app.register(integrationsRoutes);
	app.register(billingPublicRoutes);

	app.register(async function protectedRoutes(instance) {
		instance.addHook("onRequest", requireAuth);

		instance.register(workspaceRoutes);
		instance.register(widgetConfigRoutes);
		instance.register(contactRoutes);
		instance.register(conversationRoutes);
		instance.register(messageRoutes);
		instance.register(uploadRoutes);
		instance.register(cannedResponseRoutes);
		instance.register(copilotRoutes);
		instance.register(knowledgeRoutes);
		instance.register(billingRoutes);
		instance.register(apiTokenRoutes);
		instance.register(reportRoutes);
		instance.register(securityRoutes);
		instance.register(integrationsProtectedRoutes);
	});

	return app;
}
