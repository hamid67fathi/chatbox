ALTER TABLE "workspaces"
	ADD COLUMN IF NOT EXISTS "ai_persona" jsonb NOT NULL DEFAULT '{}'::jsonb;
