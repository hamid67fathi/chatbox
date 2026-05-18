CREATE TABLE IF NOT EXISTS "contact_attribute_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_attribute_definitions" ADD CONSTRAINT "contact_attribute_definitions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_contact_attr_def_ws_key" ON "contact_attribute_definitions" ("workspace_id","key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_attribute_values" (
	"contact_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_attribute_values_pkey" PRIMARY KEY ("contact_id","definition_id")
);
--> statement-breakpoint
ALTER TABLE "contact_attribute_values" ADD CONSTRAINT "contact_attribute_values_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_attribute_values" ADD CONSTRAINT "contact_attribute_values_definition_id_contact_attribute_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."contact_attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;
