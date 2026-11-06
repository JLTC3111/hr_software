-- Isolated PostgreSQL 17 regression test; never run against a Supabase project.
-- Run with psql -X -v ON_ERROR_STOP=1 -d recovery_test -f this-file.sql.
-- The database must have no auth.users table or Supabase fixture roles.
-- All fixture schema, roles, users and the applied migration roll back.
\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'recovery_test' OR to_regclass('auth.users') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) THEN
    RAISE EXCEPTION 'Use only the empty local recovery_test fixture database';
  END IF;
END;
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  deleted_at timestamptz,
  banned_until timestamptz,
  is_sso_user boolean DEFAULT false,
  is_anonymous boolean DEFAULT false
);

\ir ../migrations/20261106164826_enforce_registered_password_recovery.sql

INSERT INTO auth.users (email, email_confirmed_at, deleted_at, banned_until, is_sso_user, is_anonymous)
VALUES
  ('Mixed.QA+tag@Example.Test', now(), NULL, NULL, false, false),
  ('deleted@example.test', now(), now(), NULL, false, false),
  ('banned@example.test', now(), NULL, now() + interval '1 day', false, false),
  ('expired-ban@example.test', now(), NULL, now() - interval '1 day', false, false),
  ('sso@example.test', now(), NULL, NULL, true, false),
  ('anonymous@example.test', now(), NULL, NULL, false, true),
  ('unconfirmed@example.test', NULL, NULL, NULL, false, false),
  ('null-flags@example.test', now(), NULL, NULL, NULL, NULL);

SET LOCAL ROLE service_role;
DO $$
DECLARE
  sample record;
  actual text;
  checks integer := 0;
BEGIN
  FOR sample IN
    SELECT * FROM (VALUES
      ('Mixed.QA+tag@Example.Test', 'Mixed.QA+tag@Example.Test'),
      ('  MIXED.QA+TAG@EXAMPLE.TEST  ', 'Mixed.QA+tag@Example.Test'),
      ('unknown@example.test', NULL),
      ('qa+tag@example.test', NULL),
      ('mixed.qa+tag@example.test.extra', NULL),
      ('%@example.test', NULL),
      ('mixed.qa_tag@example.test', NULL),
      ('%', NULL),
      (NULL, NULL),
      ('', NULL),
      ('  ', NULL),
      ('deleted@example.test', NULL),
      ('banned@example.test', NULL),
      ('sso@example.test', NULL),
      ('anonymous@example.test', NULL),
      ('unconfirmed@example.test', 'unconfirmed@example.test'),
      ('expired-ban@example.test', 'expired-ban@example.test'),
      ('null-flags@example.test', 'null-flags@example.test')
    ) AS cases(input, expected)
  LOOP
    actual := public.password_recovery_email(sample.input);
    IF actual IS DISTINCT FROM sample.expected THEN
      RAISE EXCEPTION 'Lookup failed for %: expected %, got %', sample.input, sample.expected, actual;
    END IF;
    checks := checks + 1;
  END LOOP;
  RAISE NOTICE 'PASS: % exact-match and eligibility assertions as service_role', checks;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.password_recovery_email('Mixed.QA+tag@Example.Test');
    RAISE EXCEPTION 'Anonymous RPC access was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anonymous RPC execution denied';
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.password_recovery_email('Mixed.QA+tag@Example.Test');
    RAISE EXCEPTION 'Authenticated RPC access was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated RPC execution denied';
  END;
END;
$$;
RESET ROLE;

DO $$
DECLARE
  procedure pg_proc;
BEGIN
  SELECT * INTO STRICT procedure FROM pg_proc
    WHERE oid = 'public.password_recovery_email(text)'::regprocedure;
  IF NOT procedure.prosecdef THEN RAISE EXCEPTION 'Lookup lost its definer boundary'; END IF;
  IF procedure.proconfig IS NULL OR NOT procedure.proconfig @> ARRAY['search_path=""'] THEN
    RAISE EXCEPTION 'Lookup search_path is not fixed and empty: %', procedure.proconfig;
  END IF;
  IF has_function_privilege('anon', procedure.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous execute grant exists';
  END IF;
  IF has_function_privilege('authenticated', procedure.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated execute grant exists';
  END IF;
  IF NOT has_function_privilege('service_role', procedure.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Service execute grant is missing';
  END IF;
  RAISE NOTICE 'PASS: 5 function security and ACL assertions';
END;
$$;

ROLLBACK;
