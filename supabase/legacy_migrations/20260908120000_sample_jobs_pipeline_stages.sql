-- The three seed postings were all closed with no applications, so Board and
-- Table were empty. Give each posting a different pipeline stage and reopen
-- the two that are still hiring.

UPDATE public.job_postings AS jp
SET
  status = v.status,
  updated_at = CURRENT_TIMESTAMP
FROM (VALUES
  ('Senior Software Engineer', 'open'),
  ('Marketing Manager', 'published'),
  ('HR Coordinator', 'closed')
) AS v(title, status)
WHERE jp.title = v.title
  AND jp.posted_date = DATE '2025-10-28';

WITH people AS (
  INSERT INTO public.applicants (
    full_name, email, current_position, years_of_experience, education_level
  )
  VALUES
    ('Alex Rivera', 'sample.pipeline.screening@example.com', 'Software Engineer', 6, 'BSc Computer Science'),
    ('Priya Shah', 'sample.pipeline.interview@example.com', 'Marketing Lead', 8, 'MBA'),
    ('Minh Tran', 'sample.pipeline.hired@example.com', 'HR Assistant', 4, 'BA Human Resources')
  ON CONFLICT (email) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        current_position = EXCLUDED.current_position,
        years_of_experience = EXCLUDED.years_of_experience,
        education_level = EXCLUDED.education_level
  RETURNING id, email
),
jobs AS (
  SELECT id, title
  FROM public.job_postings
  WHERE posted_date = DATE '2025-10-28'
    AND title IN ('Senior Software Engineer', 'Marketing Manager', 'HR Coordinator')
)
INSERT INTO public.applications (
  job_posting_id, applicant_id, status, application_date, rating, notes, reviewed_date
)
SELECT
  j.id,
  p.id,
  s.status,
  s.applied_at,
  s.rating,
  s.notes,
  s.reviewed_at
FROM people p
JOIN (VALUES
  (
    'sample.pipeline.screening@example.com',
    'Senior Software Engineer',
    'under review',
    TIMESTAMP '2026-08-20 09:00:00',
    3,
    'CV in screening.',
    TIMESTAMP '2026-08-21 10:00:00'
  ),
  (
    'sample.pipeline.interview@example.com',
    'Marketing Manager',
    'interview scheduled',
    TIMESTAMP '2026-07-15 09:00:00',
    4,
    'Panel scheduled.',
    TIMESTAMP '2026-08-01 11:00:00'
  ),
  (
    'sample.pipeline.hired@example.com',
    'HR Coordinator',
    'hired',
    TIMESTAMP '2026-06-02 09:00:00',
    5,
    'Offer accepted.',
    TIMESTAMP '2026-07-10 16:00:00'
  )
) AS s(email, title, status, applied_at, rating, notes, reviewed_at)
  ON s.email = p.email
JOIN jobs j ON j.title = s.title
ON CONFLICT (job_posting_id, applicant_id) DO UPDATE
  SET status = EXCLUDED.status,
      rating = EXCLUDED.rating,
      notes = EXCLUDED.notes,
      application_date = EXCLUDED.application_date,
      reviewed_date = EXCLUDED.reviewed_date;
