ALTER TABLE "conversations"
	ADD COLUMN IF NOT EXISTS "first_response_at" timestamp with time zone;

ALTER TABLE "conversations"
	ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL UNIQUE REFERENCES "workspaces"("id") ON DELETE CASCADE,
	"enabled" boolean NOT NULL DEFAULT true,
	"first_response_minutes" integer NOT NULL DEFAULT 15,
	"resolution_minutes" integer NOT NULL DEFAULT 1440,
	"warn_at_percent" integer NOT NULL DEFAULT 80,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

UPDATE "conversations"
SET "first_response_at" = "created_at" + ("first_response_sec" || ' seconds')::interval
WHERE "first_response_sec" IS NOT NULL
	AND "first_response_at" IS NULL;

UPDATE "conversations"
SET "resolved_at" = "closed_at"
WHERE "closed_at" IS NOT NULL
	AND "resolved_at" IS NULL
	AND "status" IN ('resolved', 'closed');
