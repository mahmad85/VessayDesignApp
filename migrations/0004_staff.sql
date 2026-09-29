CREATE TABLE IF NOT EXISTS staff_roles (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('owner','catalog_manager','order_manager','tailor','support')), granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, role));
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
CREATE TABLE IF NOT EXISTS two_factor (id text PRIMARY KEY, secret text NOT NULL, backup_codes text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, verified boolean DEFAULT true, failed_verification_count integer DEFAULT 0, locked_until timestamp);
CREATE INDEX IF NOT EXISTS two_factor_secret_idx ON two_factor(secret);
CREATE INDEX IF NOT EXISTS two_factor_user_idx ON two_factor(user_id);
