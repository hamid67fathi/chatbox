-- P4: Authentication tables
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "refresh_token" text NOT NULL UNIQUE,
    "user_agent" text,
    "ip_address" text,
    "expires_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_refresh" ON "sessions" ("refresh_token");

CREATE TABLE IF NOT EXISTS "otp_codes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" text,
    "phone" text,
    "code" text NOT NULL,
    "used" boolean NOT NULL DEFAULT false,
    "expires_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_otp_email" ON "otp_codes" ("email");
CREATE INDEX IF NOT EXISTS "idx_otp_phone" ON "otp_codes" ("phone");
