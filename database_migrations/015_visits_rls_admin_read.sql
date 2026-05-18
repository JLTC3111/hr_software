-- Run if visits table already exists: enable admin read via RLS (inserts use record-visit edge function)

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read visits" ON visits;
CREATE POLICY "Admins can read visits"
  ON visits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM hr_users hu
      WHERE hu.role = 'admin'
        AND (
          hu.id = auth.uid()
          OR hu.id IN (
            SELECT ue.hr_user_id
            FROM user_emails ue
            WHERE ue.auth_user_id = auth.uid()
          )
        )
    )
  );
