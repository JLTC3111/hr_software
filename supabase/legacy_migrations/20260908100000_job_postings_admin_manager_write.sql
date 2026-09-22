-- Job posting writes are admin and manager only. SELECT stays open so every
-- signed-in user can still read the requisition list.
-- Role is resolved through private.current_hr_role() (active hr_users row,
-- including user_emails auth mapping), matching other live HR policies.

DROP POLICY IF EXISTS "Authenticated users can insert job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can update job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can delete job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins and managers can insert job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins and managers can update job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins and managers can delete job postings" ON public.job_postings;

CREATE POLICY "Admins and managers can insert job postings"
  ON public.job_postings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT private.current_hr_role()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can update job postings"
  ON public.job_postings
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT private.current_hr_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    (SELECT private.current_hr_role()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can delete job postings"
  ON public.job_postings
  FOR DELETE
  TO authenticated
  USING (
    (SELECT private.current_hr_role()) IN ('admin', 'manager')
  );
