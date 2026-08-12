-- ============================================================
-- AI YouTube Video Production Platform — Postgres schema (Railway)
-- ============================================================
-- ============================================================

-- ---------- USERS & CHANNEL ----------

CREATE TABLE users (
  id                TEXT PRIMARY KEY,        -- uuid
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT,                    -- null if OAuth-only
  auth_provider     TEXT NOT NULL DEFAULT 'password', -- 'password' | 'google'
  full_name         TEXT,
  role              TEXT NOT NULL DEFAULT 'user',      -- 'user' | 'admin'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE channel_dna (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  channel_name      TEXT,
  niche             TEXT,
  target_audience   TEXT,
  preferred_language TEXT DEFAULT 'en',
  preferred_voice_id TEXT,
  tone              TEXT,
  visual_style      TEXT,
  intro_asset_id    TEXT,
  outro_asset_id    TEXT,
  preferred_colors  TEXT,                    -- JSON array
  pacing            TEXT,
  thumbnail_style   TEXT,
  recurring_elements TEXT,                   -- JSON
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- SUBSCRIPTIONS & BILLING ----------

CREATE TABLE plans (
  id                TEXT PRIMARY KEY,        -- 'starter' | 'creator' | 'pro' | 'studio' | 'agency'
  name              TEXT NOT NULL,
  price_inr         INTEGER NOT NULL,
  production_minutes INTEGER NOT NULL,
  is_popular        INTEGER DEFAULT 0,
  rollover_pct      INTEGER DEFAULT 50,       -- configurable, section 21
  active            INTEGER DEFAULT 1,
  sort_order        INTEGER DEFAULT 0
);

CREATE TABLE overage_packs (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  minutes           INTEGER NOT NULL,
  price_inr         INTEGER NOT NULL,
  active            INTEGER DEFAULT 1
);

CREATE TABLE subscriptions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  plan_id           TEXT NOT NULL REFERENCES plans(id),
  status            TEXT NOT NULL DEFAULT 'active', -- active | expired | cancelled | trial
  razorpay_sub_id   TEXT,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end   TIMESTAMPTZ NOT NULL,
  minutes_total     INTEGER NOT NULL,        -- plan allocation + rollover + overage packs
  minutes_used      INTEGER NOT NULL DEFAULT 0,
  rolled_over_minutes INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  razorpay_payment_id TEXT UNIQUE,
  razorpay_order_id  TEXT,
  amount_inr        INTEGER NOT NULL,
  purpose           TEXT NOT NULL,            -- 'subscription' | 'overage_pack' | 'trial'
  status             TEXT NOT NULL,           -- 'created' | 'captured' | 'failed' | 'refunded'
  idempotency_key    TEXT UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- VIDEO PIPELINE ----------

CREATE TABLE videos (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  topic             TEXT NOT NULL,
  language          TEXT NOT NULL DEFAULT 'en',
  duration_target_sec INTEGER NOT NULL,        -- 120/180/300/420/600
  content_style     TEXT,                       -- educational | professional | ...
  visual_style      TEXT,                       -- clean | modern | corporate | ...
  voice_id          TEXT,
  production_mode   TEXT NOT NULL DEFAULT 'standard', -- standard | premium | cinematic
  status            TEXT NOT NULL DEFAULT 'draft',
  -- draft | researching | scripting | storyboarding | generating_visuals |
  -- generating_voice | composing | captioning | thumbnailing | packaging |
  -- review | completed | failed
  production_minutes_consumed REAL DEFAULT 0,
  originality_score INTEGER,
  final_video_r2_key TEXT,
  thumbnail_r2_key   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE video_briefs (            -- Step 1 output
  video_id          TEXT PRIMARY KEY REFERENCES videos(id),
  target_audience   TEXT,
  intent            TEXT,
  key_concepts      TEXT,              -- JSON array
  structure_outline TEXT,              -- JSON
  research_requirements TEXT           -- JSON array
);

CREATE TABLE research_items (          -- Step 2 output, stored separately from script
  id                TEXT PRIMARY KEY,
  video_id          TEXT NOT NULL REFERENCES videos(id),
  source_url        TEXT,
  source_title      TEXT,
  fact_summary      TEXT,
  is_statistic      INTEGER DEFAULT 0,
  confidence        TEXT,              -- 'high' | 'medium' | 'low'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scripts (
  id                TEXT PRIMARY KEY,
  video_id          TEXT NOT NULL REFERENCES videos(id),
  version           INTEGER NOT NULL DEFAULT 1,
  content           TEXT NOT NULL,     -- full script text, sectioned
  word_count        INTEGER,
  is_user_edited    INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE storyboard_scenes (
  id                TEXT PRIMARY KEY,
  video_id          TEXT NOT NULL REFERENCES videos(id),
  scene_number      INTEGER NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  narration         TEXT NOT NULL,
  visual_type       TEXT NOT NULL,     -- ai_video|ai_image|stock_video|stock_image|chart|
                                        -- diagram|screenshot|animated_text|motion_graphic|
                                        -- map|icon_animation|creator_asset
  visual_tier       INTEGER,           -- 1-5, set by Visual Router
  visual_prompt     TEXT,
  on_screen_text    TEXT,
  transition        TEXT,
  music_cue         TEXT,
  sfx_cue           TEXT,
  asset_r2_key      TEXT,              -- resolved asset once generated
  reused_asset_id   TEXT,              -- FK to asset_library.id if reused
  status            TEXT DEFAULT 'pending', -- pending|generating|done|failed
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE captions (
  id                TEXT PRIMARY KEY,
  video_id          TEXT NOT NULL REFERENCES videos(id),
  start_ms          INTEGER NOT NULL,
  end_ms            INTEGER NOT NULL,
  text              TEXT NOT NULL
);

CREATE TABLE youtube_pack (
  video_id          TEXT PRIMARY KEY REFERENCES videos(id),
  titles            TEXT,              -- JSON array of 3-5
  description       TEXT,
  chapters          TEXT,              -- JSON [{time, label}]
  tags              TEXT,              -- JSON array
  hashtags          TEXT,              -- JSON array
  pinned_comment    TEXT,
  community_post    TEXT,
  shorts_clips      TEXT               -- JSON [{start,end,reason}]
);

-- ---------- ASSET LIBRARY (section 9) ----------

CREATE TABLE asset_library (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  asset_type        TEXT NOT NULL,     -- image|video|music|sfx|logo|icon|character|intro|outro
  r2_key            TEXT NOT NULL,
  source_prompt     TEXT,              -- prompt used to generate, for semantic reuse matching
  embedding         TEXT,              -- vector embedding (JSON) for similarity search on reuse
  tags              TEXT,              -- JSON array
  reuse_count       INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- JOBS & QUEUE (section 27) ----------

CREATE TABLE video_jobs (
  id                TEXT PRIMARY KEY,
  video_id          TEXT NOT NULL REFERENCES videos(id),
  stage             TEXT NOT NULL,     -- research|script|storyboard|asset|voice|composition|caption|thumbnail|final_render
  status            TEXT NOT NULL DEFAULT 'queued', -- queued|running|succeeded|failed|retrying
  progress_pct      INTEGER DEFAULT 0,
  attempt_count     INTEGER DEFAULT 0,
  max_attempts      INTEGER DEFAULT 3,
  provider_used     TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- PROVIDER ABSTRACTION & COST TRACKING (section 8, 29) ----------

CREATE TABLE providers (
  id                TEXT PRIMARY KEY,   -- 'openai' | 'anthropic' | 'elevenlabs' | 'runway' | ...
  provider_type     TEXT NOT NULL,      -- llm|image|video|tts|music|stt|search
  display_name      TEXT,
  active            INTEGER DEFAULT 1,
  priority          INTEGER DEFAULT 0,  -- fallback order
  config            TEXT                -- JSON: base_url, model names, etc (NOT secrets)
);

CREATE TABLE model_pricing (
  id                TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL REFERENCES providers(id),
  model_name        TEXT NOT NULL,
  unit_type         TEXT NOT NULL,      -- 'per_1k_tokens'|'per_image'|'per_second_video'|'per_char_tts'
  cost_inr          REAL NOT NULL,
  quality_tier      INTEGER,            -- 1-5, maps to production tiers
  active            INTEGER DEFAULT 1,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE generation_events (         -- one row per provider call, mandatory
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  video_id          TEXT NOT NULL,
  scene_id          TEXT,
  provider_id       TEXT NOT NULL,
  model_name        TEXT NOT NULL,
  input_units       REAL,
  output_units      REAL,
  actual_cost_inr   REAL NOT NULL,
  production_minutes_consumed REAL NOT NULL,
  generation_time_ms INTEGER,
  retry_count       INTEGER DEFAULT 0,
  quality_score     REAL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_events_video ON generation_events(video_id);
CREATE INDEX idx_gen_events_user ON generation_events(user_id);
CREATE INDEX idx_videos_user ON videos(user_id);
CREATE INDEX idx_scenes_video ON storyboard_scenes(video_id);
CREATE INDEX idx_jobs_video ON video_jobs(video_id);

-- ---------- ADMIN CONFIG (section 31) ----------

CREATE TABLE feature_flags (
  key               TEXT PRIMARY KEY,
  enabled           INTEGER DEFAULT 0,
  description       TEXT
);

CREATE TABLE app_config (                -- generic key/value for admin-tunable settings
  key               TEXT PRIMARY KEY,    -- e.g. 'trial_price_inr', 'production_mode_multiplier_premium'
  value             TEXT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
