-- A missing self-assessment must not block the cycle. This flag records that
-- HR continued without one, so the pipeline can stay honest instead of
-- treating a manager review as proof the employee assessed themselves.

ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS self_assessment_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.performance_reviews.self_assessment_skipped IS
  'True when the cycle continued without a self-assessment for this period.';
