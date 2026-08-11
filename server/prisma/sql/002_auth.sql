-- Milestone 5: auth tables. Run via npm run db:apply-auth if prisma push hangs.

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'user',
  phone           TEXT,
  business_name   TEXT,
  notifications   JSONB,
  google_id       TEXT UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT false,
  registered      BOOLEAN NOT NULL DEFAULT true,
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code        TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'register',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_codes_email_purpose_idx ON otp_codes (email, purpose);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx ON password_reset_tokens (email);

CREATE TABLE IF NOT EXISTS app_settings (
  id               TEXT PRIMARY KEY DEFAULT 'default',
  public_settings  JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO app_settings (id, public_settings)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
