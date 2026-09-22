-- Hand-authored translations for user-generated content (tasks, personal goals,
-- performance reviews, leave requests).
--
-- Machine translation already happens on-device via the Chromium Translator API
-- (src/services/translateService.js). That output is deliberately never stored:
-- it is per-reader, free, and regenerated on demand. This table holds only text
-- a human wrote or approved in the Translation Studio, which is why it outranks
-- the machine draft everywhere UGC is rendered.
--
-- Supersedes the orphaned translation_cache table from migration 017, whose
-- companion edge function (supabase/functions/translate) has been removed. That
-- table is left in place here; see the note at the end of this file.

CREATE TABLE IF NOT EXISTS public.hr_ugc_translations (
  -- 'task' | 'goal' | 'review' | 'leave'
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'goal', 'review', 'leave')),
  -- TEXT rather than a typed FK: goals, reviews and leave requests are keyed by
  -- BIGSERIAL while workload_tasks was created outside this migration chain, so
  -- one polymorphic column cannot reference all four. Deletes are handled by the
  -- cleanup triggers at the bottom of this file instead of ON DELETE CASCADE.
  entity_id   TEXT NOT NULL,
  -- Column name on the source row, e.g. 'title' | 'description' | 'notes'.
  field       TEXT NOT NULL,
  -- App language code as used by SUPPORTED_LANGUAGES (en, de, fr, jp, kr, th,
  -- vn, ru, es) — NOT BCP-47. Keeping the app's codes avoids a lossy mapping in
  -- both directions; translateService owns the BCP-47 conversion.
  locale      TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  -- Snapshot of the source text this translation was written against. When the
  -- source is later edited these stop matching and the Studio flags the row as
  -- stale rather than silently serving a translation of text that no longer
  -- exists.
  source_text TEXT NOT NULL DEFAULT '',
  -- Secondary lookup key: identical source strings share a translation across
  -- records, which is what makes the Studio's work reusable instead of
  -- per-row. Maintained by the trigger below so it can never drift.
  source_hash TEXT NOT NULL DEFAULT '',
  provider    TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'machine')),
  updated_by  UUID REFERENCES public.hr_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id, field, locale)
);

-- The Studio loads every override for one locale in a single request.
CREATE INDEX IF NOT EXISTS idx_hr_ugc_translations_locale
  ON public.hr_ugc_translations (locale);

-- Text-keyed reuse: "what has anyone already written for this exact string?"
CREATE INDEX IF NOT EXISTS idx_hr_ugc_translations_source_hash
  ON public.hr_ugc_translations (source_hash, locale);

CREATE INDEX IF NOT EXISTS idx_hr_ugc_translations_entity
  ON public.hr_ugc_translations (entity_type, entity_id);

-- ============================================
-- source_hash maintenance
-- ============================================
-- sha256() is core Postgres (11+), so this needs no extension — deliberately,
-- because pgcrypto's digest() lives in the `extensions` schema on Supabase and
-- would not resolve under the pinned search_path above.
--
-- The client never recomputes this: it keys its in-memory index off the
-- source_text column it already loaded, so there is no hash algorithm to keep
-- in sync across two languages. The column exists to keep server-side lookups
-- ("what has anyone written for this exact string?") on a narrow index.
CREATE OR REPLACE FUNCTION public.hr_ugc_source_hash(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT encode(sha256(convert_to(btrim(COALESCE(p_text, '')), 'UTF8')), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.hr_ugc_translations_set_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.source_hash := public.hr_ugc_source_hash(NEW.source_text);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_ugc_translations_hash ON public.hr_ugc_translations;
CREATE TRIGGER trg_hr_ugc_translations_hash
  BEFORE INSERT OR UPDATE ON public.hr_ugc_translations
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_set_hash();

-- ============================================
-- Row level security
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_ugc_translations TO authenticated;

ALTER TABLE public.hr_ugc_translations ENABLE ROW LEVEL SECURITY;

-- Who may author a translation: admins only, for now.
--
-- A translation is published text that every other user reads in place of the
-- original, and a wrong one is invisible to everyone who cannot read both
-- languages. That makes it an editorial privilege rather than an ownership one,
-- so it starts at the narrowest useful setting.
--
-- To widen later, this function is the only thing that changes — the four
-- policies below and the entire client already route through it. Adding
-- 'manager' is a one-word edit; extending it to record owners means restoring a
-- per-entity dispatch that joins the record back to hr_users.employee_id.
--
-- SECURITY DEFINER so the hr_users lookup is not itself re-filtered by
-- hr_users' own RLS.
CREATE OR REPLACE FUNCTION public.hr_can_translate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.hr_users hu
     WHERE hu.id = auth.uid()
       AND hu.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.hr_can_translate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_can_translate() TO authenticated;

DROP POLICY IF EXISTS hr_ugc_translations_select ON public.hr_ugc_translations;
-- Readable by every signed-in user: a translation is only ever shown alongside
-- source text the reader already had access to, and withholding it here would
-- just downgrade them to the machine draft of the same sentence.
CREATE POLICY hr_ugc_translations_select
  ON public.hr_ugc_translations
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS hr_ugc_translations_insert ON public.hr_ugc_translations;
CREATE POLICY hr_ugc_translations_insert
  ON public.hr_ugc_translations
  FOR INSERT TO authenticated
  WITH CHECK (public.hr_can_translate());

DROP POLICY IF EXISTS hr_ugc_translations_update ON public.hr_ugc_translations;
CREATE POLICY hr_ugc_translations_update
  ON public.hr_ugc_translations
  FOR UPDATE TO authenticated
  USING (public.hr_can_translate())
  WITH CHECK (public.hr_can_translate());

DROP POLICY IF EXISTS hr_ugc_translations_delete ON public.hr_ugc_translations;
CREATE POLICY hr_ugc_translations_delete
  ON public.hr_ugc_translations
  FOR DELETE TO authenticated
  USING (public.hr_can_translate());

-- Only safe once nothing references it: the policies above were just rebuilt on
-- the no-argument form. Present in case a pre-release copy of this migration
-- was applied by hand, since CREATE OR REPLACE cannot change a signature.
DROP FUNCTION IF EXISTS public.hr_can_translate(TEXT, TEXT);

-- ============================================
-- Cleanup on source-record delete
-- ============================================
-- Stands in for the ON DELETE CASCADE that a polymorphic entity_id cannot have.
CREATE OR REPLACE FUNCTION public.hr_ugc_translations_prune()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.hr_ugc_translations
   WHERE entity_type = TG_ARGV[0]
     AND entity_id = OLD.id::TEXT;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_ugc_translations ON public.workload_tasks;
CREATE TRIGGER trg_prune_ugc_translations
  AFTER DELETE ON public.workload_tasks
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_prune('task');

DROP TRIGGER IF EXISTS trg_prune_ugc_translations ON public.performance_goals;
CREATE TRIGGER trg_prune_ugc_translations
  AFTER DELETE ON public.performance_goals
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_prune('goal');

DROP TRIGGER IF EXISTS trg_prune_ugc_translations ON public.performance_reviews;
CREATE TRIGGER trg_prune_ugc_translations
  AFTER DELETE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_prune('review');

DROP TRIGGER IF EXISTS trg_prune_ugc_translations ON public.leave_requests;
CREATE TRIGGER trg_prune_ugc_translations
  AFTER DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_prune('leave');

-- ============================================
-- Note on migration 017
-- ============================================
-- translation_cache (017) stored Google Cloud Translation output for
-- supabase/functions/translate, which was deleted in commit 4fe7ead. Nothing
-- reads that table and nothing can write it — only the service role had access,
-- and its only caller is gone.
--
-- Dropping it is left as a deliberate manual step rather than folded in here:
-- it may still hold paid translation output worth exporting, and this migration
-- has no need to destroy anything to do its job. When you are satisfied it is
-- empty or exported:
--
--   DROP TABLE IF EXISTS public.translation_cache;

COMMENT ON TABLE public.hr_ugc_translations IS
  'Hand-authored translations of user-generated HR content. Machine translation runs on-device and is never persisted here.';
