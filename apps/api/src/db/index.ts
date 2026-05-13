import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://chatbox:chatbox@localhost:5432/chatbox";

const client = postgres(databaseUrl);

export const db = drizzle(client, { schema });

export type Database = typeof db;
