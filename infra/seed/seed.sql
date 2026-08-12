-- Seed data: plans, overage packs, providers, model pricing, feature flags
-- Run after migrations: wrangler d1 execute idea2video --file=infra/seed/seed.sql

INSERT INTO plans (id, name, price_inr, production_minutes, is_popular, rollover_pct, sort_order) VALUES
('starter', 'Starter', 4999, 30, 0, 50, 1),
('creator', 'Creator', 9999, 100, 1, 50, 2),
('pro', 'Pro', 19999, 300, 0, 50, 3),
('studio', 'Studio', 39999, 600, 0, 50, 4),
('agency', 'Agency', 99999, 1500, 0, 50, 5);

INSERT INTO overage_packs (id, name, minutes, price_inr) VALUES
('pack_30', '+30 minutes', 30, 2499),
('pack_100', '+100 minutes', 100, 6999),
('pack_300', '+300 minutes', 300, 17999);

INSERT INTO providers (id, provider_type, display_name, priority, config) VALUES
('openai', 'llm', 'OpenAI GPT-4o-mini', 1, '{"model":"gpt-4o-mini"}'),
('anthropic', 'llm', 'Claude Sonnet', 2, '{"model":"claude-sonnet"}'),
('replicate', 'image', 'Replicate SDXL', 1, '{}'),
('replicate-video', 'video', 'Replicate Video Model', 1, '{}'),
('runway', 'video', 'Runway (cinematic tier)', 2, '{}'),
('elevenlabs', 'tts', 'ElevenLabs Multilingual', 1, '{}'),
('pexels', 'search', 'Pexels Stock', 1, '{}'),
('serper', 'search', 'Serper Web Search', 1, '{}');

INSERT INTO model_pricing (id, provider_id, model_name, unit_type, cost_inr, quality_tier) VALUES
('mp1', 'openai', 'gpt-4o-mini', 'per_1k_tokens', 0.03, 3),
('mp2', 'replicate', 'sdxl', 'per_image', 2.5, 3),
('mp3', 'replicate-video', 'basic-video-model', 'per_second_video', 25, 4),
('mp4', 'runway', 'gen-3', 'per_second_video', 120, 5),
('mp5', 'elevenlabs', 'eleven_multilingual_v2', 'per_1k_chars', 15, 3),
('mp6', 'pexels', 'stock', 'per_asset', 0, 2),
('mp7', 'serper', 'search', 'per_query', 0.5, 1);

INSERT INTO app_config (key, value) VALUES
('target_cost_per_min_standard_inr', '30'),
('target_cost_per_min_premium_inr', '85'),
('target_cost_per_min_cinematic_inr', '215'),
('production_multiplier_standard', '1'),
('production_multiplier_premium', '2.5'),
('production_multiplier_cinematic', '6'),
('trial_price_inr', '499'),
('trial_minutes', '5'),
('rollover_pct_default', '50');

INSERT INTO feature_flags (key, enabled, description) VALUES
('ai_video_tier4_enabled', 1, 'Allow AI-generated video (Tier 4) outside standard mode'),
('cinematic_mode_enabled', 0, 'Enable cinematic production mode (Phase 3)'),
('multilingual_enabled', 0, 'Enable non-English/Hindi languages (Phase 2)'),
('shorts_generation_enabled', 0, 'Enable auto Shorts clip extraction (Phase 2)'),
('channel_dna_enabled', 0, 'Enable Channel DNA profile (Phase 2)');
