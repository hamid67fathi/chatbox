CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,
	"actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"diff" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_workspace_created"
	ON "audit_logs" ("workspace_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_action"
	ON "audit_logs" ("workspace_id", "action", "created_at" DESC);
