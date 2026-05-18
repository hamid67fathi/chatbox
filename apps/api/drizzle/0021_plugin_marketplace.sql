CREATE TABLE IF NOT EXISTS "plugin_catalog" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"icon" text DEFAULT '🔌' NOT NULL,
	"integration_type" text DEFAULT 'webhook' NOT NULL,
	"setup_path" text,
	"docs_url" text,
	"default_events" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installed_plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plugin_slug" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_endpoint_id" uuid,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installed_plugins" ADD CONSTRAINT "installed_plugins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "installed_plugins" ADD CONSTRAINT "installed_plugins_plugin_slug_plugin_catalog_slug_fk" FOREIGN KEY ("plugin_slug") REFERENCES "public"."plugin_catalog"("slug") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "installed_plugins" ADD CONSTRAINT "installed_plugins_webhook_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_installed_plugins_workspace_slug" ON "installed_plugins" USING btree ("workspace_id","plugin_slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_installed_plugins_workspace" ON "installed_plugins" USING btree ("workspace_id");
--> statement-breakpoint
INSERT INTO "plugin_catalog" ("slug", "name", "description", "category", "icon", "integration_type", "setup_path", "docs_url", "default_events", "sort_order")
VALUES
	(
		'zapier',
		'Zapier',
		'ارسال رویدادهای ChatBox به Zapier (Catch Hook) برای اتوماسیون بدون کد.',
		'automation',
		'⚡',
		'webhook',
		'/webhooks',
		'https://zapier.com/apps',
		ARRAY['conversation.created', 'message.created', 'conversation.resolved']::text[],
		10
	),
	(
		'make',
		'Make',
		'اتصال به Make (Integromat) با ماژول Webhooks — سناریوهای چندمرحله‌ای.',
		'automation',
		'🔗',
		'webhook',
		'/webhooks',
		'https://www.make.com/en/help/tools/webhooks',
		ARRAY['conversation.created', 'message.created', 'conversation.resolved']::text[],
		20
	),
	(
		'custom_webhook',
		'Webhook سفارشی',
		'ارسال رویدادها به API یا سرور خودتان با امضای HMAC.',
		'developer',
		'🛠',
		'webhook',
		'/webhooks',
		NULL,
		ARRAY['conversation.created', 'message.created', 'conversation.resolved']::text[],
		30
	)
ON CONFLICT ("slug") DO NOTHING;
