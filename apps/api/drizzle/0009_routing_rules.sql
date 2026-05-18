CREATE TABLE IF NOT EXISTS "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"enabled" boolean NOT NULL DEFAULT true,
	"priority" integer NOT NULL DEFAULT 100,
	"conditions" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"action" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_routing_rules_workspace"
	ON "routing_rules" ("workspace_id", "enabled", "priority");
