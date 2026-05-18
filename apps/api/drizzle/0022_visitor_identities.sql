CREATE TABLE IF NOT EXISTS "visitor_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"method" text NOT NULL,
	"identified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_identities" ADD CONSTRAINT "visitor_identities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "visitor_identities" ADD CONSTRAINT "visitor_identities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_visitor_identities_ws_visitor" ON "visitor_identities" USING btree ("workspace_id","visitor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_visitor_identities_contact" ON "visitor_identities" USING btree ("workspace_id","contact_id");
