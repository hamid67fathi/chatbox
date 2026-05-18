CREATE TABLE IF NOT EXISTS "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"status" text NOT NULL DEFAULT 'draft',
	"trigger" text NOT NULL DEFAULT 'widget_start',
	"definition" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_flows_workspace" ON "flows" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_flows_ws_status" ON "flows" ("workspace_id", "status");

CREATE TABLE IF NOT EXISTS "flow_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
	"flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
	"conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
	"contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
	"current_node_id" text,
	"status" text NOT NULL DEFAULT 'active',
	"variables" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_flow_sessions_conv_active"
	ON "flow_sessions" ("conversation_id")
	WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_flow_sessions_workspace" ON "flow_sessions" ("workspace_id");
