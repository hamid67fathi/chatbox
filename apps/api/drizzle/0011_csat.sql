CREATE TABLE IF NOT EXISTS "csat_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
	"conversation_id" uuid NOT NULL UNIQUE REFERENCES "conversations"("id") ON DELETE CASCADE,
	"contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
	"assigned_agent_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"score" smallint NOT NULL,
	"comment" text,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "csat_score_range" CHECK ("score" >= 1 AND "score" <= 5)
);

CREATE INDEX IF NOT EXISTS "idx_csat_workspace_created"
	ON "csat_responses" ("workspace_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_csat_agent"
	ON "csat_responses" ("workspace_id", "assigned_agent_id");
