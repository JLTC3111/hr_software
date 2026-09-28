-- Store goal discussions and check-in notes with their own stable record keys.
-- Existing translation RLS and privileges continue to govern every write.
ALTER TABLE public.hr_ugc_translations
  DROP CONSTRAINT hr_ugc_translations_entity_type_check;
ALTER TABLE public.hr_ugc_translations
  ADD CONSTRAINT hr_ugc_translations_entity_type_check
  CHECK (entity_type IN ('task', 'goal', 'review', 'leave', 'goal_comment', 'goal_check_in'));

-- Reuse the existing cleanup function, including when a goal deletion cascades
-- into these child tables, so deleted comments cannot leave orphan translations.
DROP TRIGGER IF EXISTS trg_prune_ugc_translations ON public.performance_comments;
CREATE TRIGGER trg_prune_ugc_translations
  AFTER DELETE ON public.performance_comments
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_prune('goal_comment');

DROP TRIGGER IF EXISTS trg_prune_ugc_translations ON public.goal_check_ins;
CREATE TRIGGER trg_prune_ugc_translations
  AFTER DELETE ON public.goal_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.hr_ugc_translations_prune('goal_check_in');
