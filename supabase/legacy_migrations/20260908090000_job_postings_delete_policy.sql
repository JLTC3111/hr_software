-- Job postings already grant DELETE to authenticated, but RLS had no DELETE
-- policy, so a client delete returned no rows. Match the existing
-- select/insert/update policies on this table.

DROP POLICY IF EXISTS "Authenticated users can delete job postings" ON public.job_postings;

CREATE POLICY "Authenticated users can delete job postings"
  ON public.job_postings
  FOR DELETE
  TO authenticated
  USING (true);
