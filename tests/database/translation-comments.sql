-- Runs only in the disposable HR regression database.
BEGIN;
CREATE SCHEMA translation_audit;
CREATE FUNCTION translation_audit.assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
END $$;
GRANT USAGE ON SCHEMA translation_audit TO authenticated;

INSERT INTO auth.users(id, email) VALUES
  ('90000000-0000-0000-0000-000000000001', 'translation-admin@example.test'),
  ('90000000-0000-0000-0000-000000000002', 'translation-staff@example.test');
INSERT INTO public.hr_users(id, email, first_name, role, is_active) VALUES
  ('90000000-0000-0000-0000-000000000001', 'translation-admin@example.test', 'Admin', 'admin', true),
  ('90000000-0000-0000-0000-000000000002', 'translation-staff@example.test', 'Staff', 'employee', true);
INSERT INTO public.employees(id, name, email) VALUES ('translation-fixture', 'Fixture', 'translation-fixture@example.test');
INSERT INTO public.performance_goals(id, employee_id, title) VALUES
  ('91000000-0000-0000-0000-000000000001', 'translation-fixture', 'Translation fixture goal');
INSERT INTO public.performance_comments(id, goal_id, author, comment) VALUES
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Author', 'Discussion');
INSERT INTO public.goal_check_ins(id, goal_id, employee_id, author_auth_id, note) VALUES
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'translation-fixture', '90000000-0000-0000-0000-000000000001', 'Progress note');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000001"}';
INSERT INTO public.hr_ugc_translations(entity_type, entity_id, field, locale, body, source_text) VALUES
  ('goal_comment', '92000000-0000-0000-0000-000000000001', 'comment', 'en', 'Translated discussion', 'Discussion'),
  ('goal_check_in', '92000000-0000-0000-0000-000000000001', 'note', 'en', 'Translated progress', 'Progress note');
SELECT translation_audit.assert(
  (SELECT count(*) = 2 FROM public.hr_ugc_translations WHERE entity_id = '92000000-0000-0000-0000-000000000001'),
  'admin can save and read both new source types without key collisions'
);
SELECT translation_audit.assert(
  (SELECT bool_and(source_hash = public.hr_ugc_source_hash(source_text)) FROM public.hr_ugc_translations WHERE entity_id = '92000000-0000-0000-0000-000000000001'),
  'new sources retain the existing translation hash contract'
);

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000002"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.hr_ugc_translations(entity_type, entity_id, field, locale, body, source_text)
    VALUES ('goal_comment', '92000000-0000-0000-0000-000000000001', 'comment', 'vn', 'Unauthorized', 'Discussion');
    RAISE EXCEPTION 'FAILED: non-editor wrote a goal comment translation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DELETE FROM public.performance_comments WHERE id = '92000000-0000-0000-0000-000000000001';
SELECT translation_audit.assert(
  NOT EXISTS(SELECT 1 FROM public.hr_ugc_translations WHERE entity_type = 'goal_comment' AND entity_id = '92000000-0000-0000-0000-000000000001')
  AND EXISTS(SELECT 1 FROM public.hr_ugc_translations WHERE entity_type = 'goal_check_in' AND entity_id = '92000000-0000-0000-0000-000000000001'),
  'deleting a comment prunes only its translations'
);
INSERT INTO public.performance_comments(id, goal_id, author, comment) VALUES
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Author', 'Discussion');
INSERT INTO public.hr_ugc_translations(entity_type, entity_id, field, locale, body, source_text) VALUES
  ('goal_comment', '92000000-0000-0000-0000-000000000001', 'comment', 'en', 'Translated discussion', 'Discussion');
DELETE FROM public.performance_goals WHERE id = '91000000-0000-0000-0000-000000000001';
SELECT translation_audit.assert(
  NOT EXISTS(SELECT 1 FROM public.hr_ugc_translations WHERE entity_id = '92000000-0000-0000-0000-000000000001'),
  'deleting a parent goal prunes translations for both child sources'
);
ROLLBACK;
SELECT 'Goal comment translation permissions, keys and cleanup passed';
