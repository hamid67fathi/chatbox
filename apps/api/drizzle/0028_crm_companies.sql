CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"website" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_companies_ws_domain" ON "companies" ("workspace_id","domain") WHERE domain IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_companies" (
	"contact_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text,
	CONSTRAINT "contact_companies_pkey" PRIMARY KEY ("contact_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_companies" ADD CONSTRAINT "contact_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
