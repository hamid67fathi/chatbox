DO $$ BEGIN
	CREATE TYPE "lifecycle_stage" AS ENUM('new', 'lead', 'prospect', 'customer', 'vip', 'at_risk', 'churned', 'reactivated');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "lifecycle_stage" "lifecycle_stage" DEFAULT 'new' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_lifecycle_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_lifecycle_history" ADD CONSTRAINT "contact_lifecycle_history_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_lifecycle_history" ADD CONSTRAINT "contact_lifecycle_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lifecycle_history_contact" ON "contact_lifecycle_history" ("contact_id","changed_at" DESC);
