-- Shared translation cache for Google Translate Edge Function
-- Written/read only via service role (supabase/functions/translate)

CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT translation_cache_hash_lang_unique UNIQUE (source_hash, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON translation_cache (source_hash, target_lang);

CREATE INDEX IF NOT EXISTS idx_translation_cache_updated_at
  ON translation_cache (updated_at DESC);

ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service role (edge function) can access.
DROP POLICY IF EXISTS "Service role full access translation_cache" ON translation_cache;

COMMENT ON TABLE translation_cache IS
  'Caches Google Cloud Translation results keyed by source text hash + target language.';
