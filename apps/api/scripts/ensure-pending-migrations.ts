/**
 * Idempotent apply of drizzle migrations 0012–0020.
 * Use when `db:migrate` fails on a DB originally set up with `db:push`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url =
	process.env.DATABASE_URL ??
	"postgresql://chatbox:chatbox@localhost:5432/chatbox";

const PENDING = [
	"0012_agent_performance",
	"0013_ai_language",
	"0014_ai_persona",
	"0015_contact_segments",
	"0016_push_subscriptions",
	"0017_webhook_endpoints",
	"0018_google_oauth",
	"0019_audit_logs",
	"0020_user_totp_recovery",
] as const;

const SKIP_ERROR_CODES = new Set([
	"42P07", // duplicate_table
	"42701", // duplicate_column
	"42710", // duplicate_object
	"42P16", // invalid_table_definition (constraint exists)
	"23505", // unique_violation on index create
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, "../drizzle");

function splitStatements(sql: string): string[] {
	return sql
		.split(/--> statement-breakpoint\n?/)
		.map((s) => s.trim())
		.filter(Boolean);
}

const db = postgres(url, { max: 1 });

try {
	for (const tag of PENDING) {
		const path = join(drizzleDir, `${tag}.sql`);
		const raw = readFileSync(path, "utf8");
		const statements = splitStatements(raw);
		console.log(`Applying ${tag} (${statements.length} statements)...`);
		for (const statement of statements) {
			try {
				await db.unsafe(statement);
			} catch (err) {
				const code = (err as { code?: string })?.code;
				if (code && SKIP_ERROR_CODES.has(code)) continue;
				throw err;
			}
		}
	}

	const [view] = await db<{ exists: boolean }[]>`
		SELECT EXISTS (
			SELECT 1 FROM pg_matviews
			WHERE schemaname = current_schema()
				AND matviewname = 'agent_performance_daily'
		) AS exists
	`;
	if (!view?.exists) {
		console.error("agent_performance_daily materialized view is still missing.");
		process.exit(1);
	}

	console.log("OK: pending migrations 0012–0020 applied (idempotent).");
} finally {
	await db.end();
}
