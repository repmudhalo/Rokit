-- chataggr schema. Idempotent: safe to run repeatedly (acts as migrations).

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE,                 -- nullable for Twitch-only accounts
  password_hash TEXT,                        -- null for OAuth-only accounts
  display_name  TEXT NOT NULL DEFAULT '',
  twitch_id     TEXT UNIQUE,                 -- set when linked via Twitch OAuth
  twitch_login  TEXT,
  overlay_token TEXT UNIQUE NOT NULL,        -- secret used in the OBS overlay URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email verification flag (added after initial release; safe to re-run).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Single-use, hashed, expiring tokens for email verification & password reset.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,              -- 'verify_email' | 'reset_password'
  token_hash TEXT NOT NULL,              -- sha256 of the token sent by email
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_hash_idx ON auth_tokens(kind, token_hash);
CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON auth_tokens(user_id);

CREATE TABLE IF NOT EXISTS sources (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,                 -- 'twitch' | 'kick'
  channel     TEXT NOT NULL,
  chatroom_id TEXT,                          -- optional Kick chatroom override
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, channel)
);

CREATE INDEX IF NOT EXISTS sources_user_idx ON sources(user_id);

CREATE TABLE IF NOT EXISTS overlay_settings (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  font_size     INT NOT NULL DEFAULT 18,
  max_messages  INT NOT NULL DEFAULT 60,
  theme         TEXT NOT NULL DEFAULT 'shadow',  -- legacy; superseded by fields below
  show_badges   BOOLEAN NOT NULL DEFAULT true,
  show_platform BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expanded appearance options (added after release; safe to re-run).
ALTER TABLE overlay_settings ADD COLUMN IF NOT EXISTS platform_style TEXT NOT NULL DEFAULT 'label';   -- 'label' | 'logo' | 'hidden'
ALTER TABLE overlay_settings ADD COLUMN IF NOT EXISTS platform_plain BOOLEAN NOT NULL DEFAULT false;   -- drop the chip background
ALTER TABLE overlay_settings ADD COLUMN IF NOT EXISTS show_channel   BOOLEAN NOT NULL DEFAULT false;   -- show source channel per message
ALTER TABLE overlay_settings ADD COLUMN IF NOT EXISTS message_bg     TEXT NOT NULL DEFAULT 'none';     -- 'none' | 'plate'
ALTER TABLE overlay_settings ADD COLUMN IF NOT EXISTS text_shadow    BOOLEAN NOT NULL DEFAULT true;    -- outline for readability
ALTER TABLE overlay_settings ADD COLUMN IF NOT EXISTS bg_opacity     INT NOT NULL DEFAULT 0;           -- 0-100 backdrop behind chat (0 = transparent)
