-- Preserve the live HR schema that was originally described by duplicate
-- numbered draft migrations. This migration is safe to replay.

ALTER TABLE public.hr_user_settings
  ADD COLUMN IF NOT EXISTS notification_sound boolean DEFAULT false;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS proof_file_path text;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS proof_file_url text,
  ADD COLUMN IF NOT EXISTS proof_file_name text,
  ADD COLUMN IF NOT EXISTS proof_file_type character varying(50),
  ADD COLUMN IF NOT EXISTS proof_file_path text;

CREATE INDEX IF NOT EXISTS idx_time_entries_with_proof
  ON public.time_entries(employee_id, date)
  WHERE proof_file_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_with_proof
  ON public.leave_requests(employee_id, start_date)
  WHERE proof_file_url IS NOT NULL;
