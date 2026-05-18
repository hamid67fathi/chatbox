CREATE TABLE IF NOT EXISTS "visitor_events" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"contact_id" uuid,
	"event_type" text NOT NULL,
	"url" text,
	"referrer" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_events_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_events_default" PARTITION OF "visitor_events" DEFAULT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_visitor_events_ws_visitor_created" ON "visitor_events" ("workspace_id", "visitor_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_visitor_events_ws_contact_created" ON "visitor_events" ("workspace_id", "contact_id", "created_at" DESC);
