-- Repair period-based performance assessment persistence and secure the
-- performance tables exposed through the Supabase Data API.

-- A period must identify at most one assessment per employee so PostgREST can
-- perform an atomic upsert instead of a race-prone SELECT followed by INSERT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM performance_reviews
    WHERE review_period IS NOT NULL
    GROUP BY employee_id, review_period
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add performance review uniqueness: duplicate employee/review_period rows exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.performance_reviews'::regclass
      AND conname = 'performance_reviews_employee_period_key'
  ) THEN
    ALTER TABLE public.performance_reviews
      ADD CONSTRAINT performance_reviews_employee_period_key
      UNIQUE (employee_id, review_period);
  END IF;
END $$;

-- Migration 013 introduced progress_percentage while older application paths
-- continued to use progress. Preserve both for rolling-deployment compatibility
-- and keep them synchronized, with progress_percentage as the canonical value.
ALTER TABLE public.performance_goals
  ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

UPDATE public.performance_goals
SET progress_percentage = COALESCE(progress, progress_percentage, 0)
WHERE progress_percentage IS DISTINCT FROM COALESCE(progress, progress_percentage, 0);

CREATE OR REPLACE FUNCTION public.sync_performance_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.progress_percentage := COALESCE(NEW.progress_percentage, 0);
    NEW.progress := NEW.progress_percentage;
  ELSIF NEW.progress_percentage IS DISTINCT FROM OLD.progress_percentage THEN
    NEW.progress := NEW.progress_percentage;
  ELSIF NEW.progress IS DISTINCT FROM OLD.progress THEN
    NEW.progress_percentage := NEW.progress;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_performance_goal_progress_columns
  ON public.performance_goals;
CREATE TRIGGER sync_performance_goal_progress_columns
  BEFORE INSERT OR UPDATE OF progress, progress_percentage
  ON public.performance_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_performance_goal_progress();

-- All of these tables are reached from the browser client. Explicit grants are
-- required for projects using the newer opt-in Data API exposure behavior.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.performance_goals,
     public.performance_reviews,
     public.performance_skills,
     public.skills_assessments,
     public.goal_milestones,
     public.employee_feedback
  TO authenticated;

ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_feedback ENABLE ROW LEVEL SECURITY;

-- Remove legacy policies, including broad authenticated=true policies and
-- policies based on the unsupported app.current_user_id setting.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'performance_goals',
        'performance_reviews',
        'performance_skills',
        'skills_assessments',
        'goal_milestones',
        'employee_feedback'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

CREATE POLICY "performance_goals_select"
  ON public.performance_goals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_goals.employee_id
          OR hu.employee_id = performance_goals.assigned_by
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_goals_insert"
  ON public.performance_goals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_goals.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_goals_update"
  ON public.performance_goals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_goals.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_goals.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_goals_delete"
  ON public.performance_goals
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_goals.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_reviews_select"
  ON public.performance_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_reviews.employee_id
          OR hu.employee_id = performance_reviews.reviewer_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_reviews_insert"
  ON public.performance_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_reviews.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_reviews_update"
  ON public.performance_reviews
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_reviews.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_reviews.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "performance_reviews_delete"
  ON public.performance_reviews
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND hu.role = 'admin'
    )
  );

CREATE POLICY "performance_skills_all"
  ON public.performance_skills
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_skills.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = performance_skills.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "skills_assessments_all"
  ON public.skills_assessments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = skills_assessments.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = skills_assessments.employee_id
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "goal_milestones_all"
  ON public.goal_milestones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.performance_goals pg
      JOIN public.hr_users hu ON hu.id = (SELECT auth.uid())
      WHERE pg.id = goal_milestones.goal_id
        AND (
          hu.employee_id = pg.employee_id
          OR hu.employee_id = pg.assigned_by
          OR hu.role IN ('admin', 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.performance_goals pg
      JOIN public.hr_users hu ON hu.id = (SELECT auth.uid())
      WHERE pg.id = goal_milestones.goal_id
        AND (
          hu.employee_id = pg.employee_id
          OR hu.employee_id = pg.assigned_by
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "employee_feedback_select"
  ON public.employee_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = employee_feedback.employee_id
          OR hu.employee_id = employee_feedback.feedback_from
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "employee_feedback_insert"
  ON public.employee_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = employee_feedback.feedback_from
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "employee_feedback_update"
  ON public.employee_feedback
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = employee_feedback.feedback_from
          OR hu.role IN ('admin', 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND (
          hu.employee_id = employee_feedback.feedback_from
          OR hu.role IN ('admin', 'manager')
        )
    )
  );

CREATE POLICY "employee_feedback_delete"
  ON public.employee_feedback
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hr_users hu
      WHERE hu.id = (SELECT auth.uid())
        AND hu.role IN ('admin', 'manager')
    )
  );
