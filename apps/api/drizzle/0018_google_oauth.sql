ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oauth_provider" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oauth_provider_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_oauth_provider_id"
  ON "users" ("oauth_provider", "oauth_provider_id")
  WHERE "deleted_at" IS NULL
    AND "oauth_provider" IS NOT NULL
    AND "oauth_provider_id" IS NOT NULL;
