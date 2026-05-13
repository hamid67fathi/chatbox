CREATE TYPE "public"."conversation_channel" AS ENUM('widget', 'telegram', 'email', 'api');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'pending', 'resolved', 'closed', 'spam');--> statement-breakpoint
CREATE TYPE "public"."message_sender_type" AS ENUM('contact', 'agent', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'file', 'audio', 'system', 'ai_reply');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'agent', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."workspace_plan" AS ENUM('free', 'starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"plan" "workspace_plan" DEFAULT 'free' NOT NULL,
	"locale" text DEFAULT 'fa-IR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_credits" integer DEFAULT 0 NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"password_hash" text,
	"full_name" text,
	"avatar_url" text,
	"locale" text DEFAULT 'fa-IR' NOT NULL,
	"totp_secret" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"external_id" text,
	"full_name" text,
	"email" text,
	"phone" text,
	"telegram_id" bigint,
	"avatar_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_tags" (
	"conversation_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_tags_conversation_id_tag_pk" PRIMARY KEY("conversation_id","tag")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" "conversation_channel" NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"assigned_agent_id" uuid,
	"ai_handled" boolean DEFAULT false NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"sentiment_score" numeric(3, 2),
	"csat_score" smallint,
	"subject" text,
	"last_message_at" timestamp with time zone,
	"last_agent_reply_at" timestamp with time zone,
	"first_response_sec" integer,
	"closed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_type" "message_sender_type" NOT NULL,
	"sender_user_id" uuid,
	"sender_contact_id" uuid,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"body" text,
	"attachments" jsonb,
	"reply_to_id" uuid,
	"reactions" jsonb,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"ai_confidence" numeric(3, 2),
	"ai_model" text,
	"ai_cost_usd" numeric(10, 6),
	"edited_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canned_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"shortcut" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb,
	"created_by" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_canned_ws_shortcut" UNIQUE("workspace_id","shortcut")
);
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_contact_id_contacts_id_fk" FOREIGN KEY ("sender_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspaces_owner" ON "workspaces" USING btree ("owner_user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_workspaces_plan" ON "workspaces" USING btree ("plan") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_email_active" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_phone_active" ON "users" USING btree ("phone") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_members_user" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_ws_email" ON "contacts" USING btree ("workspace_id","email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_ws_phone" ON "contacts" USING btree ("workspace_id","phone") WHERE phone IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_ws_tg" ON "contacts" USING btree ("workspace_id","telegram_id") WHERE telegram_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_contacts_metadata" ON "contacts" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "idx_conv_tags_tag" ON "conversation_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "idx_conv_ws_status" ON "conversations" USING btree ("workspace_id","status","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_conv_assigned" ON "conversations" USING btree ("assigned_agent_id","status") WHERE assigned_agent_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_conv_contact" ON "conversations" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_conv_ws_channel" ON "conversations" USING btree ("workspace_id","channel");--> statement-breakpoint
CREATE INDEX "idx_msg_conv" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_msg_ws_created" ON "messages" USING btree ("workspace_id","created_at");