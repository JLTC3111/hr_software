-- Backdatable calendar dates for when work actually ran.
-- created_at / updated_at stay as row-entry stamps: tasks are often typed in
-- after the work is already finished, so those timestamps must not be used
-- as start or completion.

ALTER TABLE public.workload_tasks
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS completion_date date;

COMMENT ON COLUMN public.workload_tasks.start_date IS
  'Calendar day work began. Backdatable; distinct from created_at.';
COMMENT ON COLUMN public.workload_tasks.completion_date IS
  'Calendar day work finished. Backdatable; distinct from updated_at.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workload_tasks_completion_after_start'
      AND conrelid = 'public.workload_tasks'::regclass
  ) THEN
    ALTER TABLE public.workload_tasks
      ADD CONSTRAINT workload_tasks_completion_after_start
      CHECK (
        completion_date IS NULL
        OR start_date IS NULL
        OR completion_date >= start_date
      );
  END IF;
END $$;
