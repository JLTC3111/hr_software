-- Visit tracking table and admin-only RLS (inserts go through record-visit edge function with service role)

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT,
  anonymized_ip TEXT,
  user_agent TEXT,
  path TEXT,
  referrer TEXT,
  user_id UUID REFERENCES auth.users(id),
  role TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE visits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS anonymized_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits (ip);
CREATE INDEX IF NOT EXISTS idx_visits_anonymized_ip ON visits (anonymized_ip);
CREATE INDEX IF NOT EXISTS idx_visits_is_demo ON visits (is_demo);
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits (user_id);

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
