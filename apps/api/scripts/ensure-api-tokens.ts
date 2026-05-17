/**
 * Idempotent apply of drizzle/0006_api_tokens.sql.
 * Use when `db:migrate` fails on a DB that was originally set up with `db:push`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url =
	process.env.DATABASE_URL ??
	"postgresql://chatbox:chatbox@localhost:5432/chatbox";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../drizzle/0006_api_tokens.sql");
const migration = readFileSync(sqlPath, "utf8");

const db = postgres(url, { max: 1 });

try {
	await db.unsafe(migration);
	const [row] = await db<{ exists: boolean }[]>`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'api_tokens'
		) AS exists
	`;
	if (!row?.exists) {
		console.error("api_tokens table was not created.");
		process.exit(1);
	}
	console.log("OK: api_tokens table is ready.");
} finally {
	await db.end();
}
