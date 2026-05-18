-- FL-38: TOTP recovery code hashes (bcrypt JSON array)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_recovery_hashes" text;
