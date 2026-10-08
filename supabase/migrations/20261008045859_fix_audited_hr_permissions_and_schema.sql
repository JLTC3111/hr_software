-- Protect the authorization scope used by can_manage_employee(). Managers may
-- place ordinary subordinates within their scope, but cannot move themselves
-- or another privileged profile into a different authorization scope.
CREATE OR REPLACE FUNCTION private.enforce_hr_user_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_role text;
  actor_id uuid;
  actor_department text;
BEGIN
  IF (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR ((SELECT auth.uid()) IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  actor_role := private.current_hr_role();
  IF actor_role = 'admin' THEN RETURN NEW; END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.salary IS DISTINCT FROM OLD.salary
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.employment_status IS DISTINCT FROM OLD.employment_status
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'Only HR administrators can change identity, role, salary, or account status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.department IS DISTINCT FROM OLD.department
    OR NEW.position IS DISTINCT FROM OLD.position
    OR NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    actor_id := private.current_hr_user_id();
    IF actor_role IS DISTINCT FROM 'manager'
      OR OLD.id = actor_id
      OR lower(OLD.role::text) IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Only HR administrators can change a manager authorization scope'
        USING ERRCODE = '42501';
    END IF;

    SELECT department INTO actor_department FROM public.hr_users WHERE id = actor_id;
    IF NOT private.can_manage_employee(OLD.employee_id)
      OR NOT coalesce(NEW.manager_id = actor_id
        OR (actor_department IS NOT NULL AND NEW.department = actor_department), false) THEN
      RAISE EXCEPTION 'Managers can only place employees within their own scope'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Keep child discussion access aligned with the parent goal's RLS. Auth users
-- from other applications are not HR members, and cannot see or create posts.
DROP POLICY IF EXISTS "Allow authenticated users to view performance comments" ON public.performance_comments;
DROP POLICY IF EXISTS "Allow authenticated users to insert performance comments" ON public.performance_comments;
DROP POLICY IF EXISTS performance_comments_scoped_select ON public.performance_comments;
DROP POLICY IF EXISTS performance_comments_scoped_insert ON public.performance_comments;
CREATE POLICY performance_comments_scoped_select ON public.performance_comments
FOR SELECT TO authenticated
USING (private.is_active_hr_user() AND EXISTS (
  SELECT 1 FROM public.performance_goals g WHERE g.id = performance_comments.goal_id
));
CREATE POLICY performance_comments_scoped_insert ON public.performance_comments
FOR INSERT TO authenticated
WITH CHECK (private.is_active_hr_user()
  AND author_id = private.current_hr_user_id()::text
  AND EXISTS (SELECT 1 FROM public.performance_goals g WHERE g.id = performance_comments.goal_id));

CREATE OR REPLACE FUNCTION private.set_performance_comment_author()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE actor_id uuid;
BEGIN
  IF (SELECT auth.jwt() ->> 'role') = 'service_role'
    OR ((SELECT auth.uid()) IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;
  IF NOT private.is_active_hr_user() THEN
    RAISE EXCEPTION 'Active HR membership required' USING ERRCODE = '42501';
  END IF;
  actor_id := private.current_hr_user_id();
  IF NEW.author_id IS NOT NULL AND NEW.author_id <> actor_id::text THEN
    RAISE EXCEPTION 'Comment author must be the current HR user' USING ERRCODE = '42501';
  END IF;
  NEW.author_id := actor_id::text;
  SELECT coalesce(nullif(full_name, ''), email) INTO NEW.author
    FROM public.hr_users WHERE id = actor_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.set_performance_comment_author() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_performance_comment_author ON public.performance_comments;
CREATE TRIGGER trg_performance_comment_author BEFORE INSERT ON public.performance_comments
FOR EACH ROW EXECUTE FUNCTION private.set_performance_comment_author();

-- Run as the reader so each source table's existing RLS remains authoritative.
-- Read permission is distinct from the administrator-only publishing permission.
CREATE OR REPLACE FUNCTION private.can_read_hr_translation(p_entity_type text, p_entity_id text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_active_hr_user() THEN RETURN false; END IF;
  CASE p_entity_type
    WHEN 'task' THEN
      RETURN EXISTS (SELECT 1 FROM public.workload_tasks WHERE id::text = p_entity_id);
    WHEN 'goal' THEN
      RETURN EXISTS (SELECT 1 FROM public.performance_goals WHERE id::text = p_entity_id);
    WHEN 'review' THEN
      RETURN EXISTS (SELECT 1 FROM public.performance_reviews WHERE id::text = p_entity_id);
    WHEN 'leave' THEN
      RETURN EXISTS (SELECT 1 FROM public.leave_requests WHERE id::text = p_entity_id);
    WHEN 'goal_comment' THEN
      RETURN EXISTS (SELECT 1 FROM public.performance_comments WHERE id::text = p_entity_id);
    WHEN 'goal_check_in' THEN
      RETURN EXISTS (SELECT 1 FROM public.goal_check_ins WHERE id::text = p_entity_id);
    ELSE RETURN false;
  END CASE;
END;
$$;
REVOKE ALL ON FUNCTION private.can_read_hr_translation(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_hr_translation(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.hr_can_translate(p_entity_type text, p_entity_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.is_hr_admin() AND private.can_read_hr_translation(p_entity_type, p_entity_id);
$$;
REVOKE ALL ON FUNCTION public.hr_can_translate(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_can_translate(text, text) TO authenticated, service_role;
DROP POLICY IF EXISTS hr_ugc_translations_select ON public.hr_ugc_translations;
CREATE POLICY hr_ugc_translations_select ON public.hr_ugc_translations
FOR SELECT TO authenticated
USING (private.can_read_hr_translation(entity_type, entity_id));

-- The advisor found one remaining globally writable legacy audit table. Keep
-- proof history scoped and append-only; callers cannot impersonate an operator.
DROP POLICY IF EXISTS compat_authenticated_all ON public.proof_file_audit;
DROP POLICY IF EXISTS proof_audit_scoped_read ON public.proof_file_audit;
DROP POLICY IF EXISTS proof_audit_scoped_insert ON public.proof_file_audit;
REVOKE ALL ON public.proof_file_audit FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.proof_file_audit FROM authenticated;
GRANT SELECT, INSERT ON public.proof_file_audit TO authenticated;
CREATE POLICY proof_audit_scoped_read ON public.proof_file_audit
FOR SELECT TO authenticated
USING (private.is_active_hr_user() AND (
  employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id)
));
CREATE POLICY proof_audit_scoped_insert ON public.proof_file_audit
FOR INSERT TO authenticated
WITH CHECK (private.is_active_hr_user()
  AND performed_by IS NOT DISTINCT FROM (SELECT private.current_employee_id())
  AND (employee_id = (SELECT private.current_employee_id()) OR private.can_manage_employee(employee_id)));

-- Match the visit handler's persisted payload without discarding analytics.
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS anonymized_ip text;

-- Removing an assessor must preserve a colleague's skill history.
ALTER TABLE public.skills_assessments DROP CONSTRAINT IF EXISTS skills_assessments_assessed_by_fkey;
ALTER TABLE public.skills_assessments ADD CONSTRAINT skills_assessments_assessed_by_fkey
FOREIGN KEY (assessed_by) REFERENCES public.employees(id) ON DELETE SET NULL;
