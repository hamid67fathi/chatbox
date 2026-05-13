import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { db } from "./db/index.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3001);

app.get("/health", async () => {
	const result = await db.execute(sql`SELECT 1 AS ok`);
	return { ok: true, db: result.length > 0 };
});

const start = async () => {
	try {
		await app.listen({ port, host: "0.0.0.0" });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

void start();
