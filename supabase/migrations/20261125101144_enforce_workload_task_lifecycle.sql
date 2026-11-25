CREATE FUNCTION private.validate_workload_task_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Preserve existing dates and allow unrelated edits to legacy rows.
    IF NEW.status IS NOT DISTINCT FROM OLD.status
      AND NEW.completion_date IS NOT DISTINCT FROM OLD.completion_date THEN
      RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'completed' THEN
      NEW.completion_date := NULL;
    ELSIF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
      AND OLD.completion_date IS NOT NULL AND NEW.completion_date = OLD.completion_date THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workload_task_completion_date_required';
    END IF;
  END IF;

  IF NEW.status IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workload_task_status_required';
  END IF;

  IF NEW.status = 'completed' THEN
    IF NEW.completion_date IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workload_task_completion_date_required';
    END IF;
    IF NOT isfinite(NEW.completion_date)
      OR NEW.completion_date > (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workload_task_completion_date_future';
    END IF;
  ELSIF NEW.completion_date IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workload_task_completion_date_requires_completed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_workload_task_lifecycle() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER workload_task_lifecycle_validation
BEFORE INSERT OR UPDATE OF status, completion_date ON public.workload_tasks
FOR EACH ROW EXECUTE FUNCTION private.validate_workload_task_lifecycle();

-- Status actions use the database clock. The existing UPDATE policies and
-- employee update guard apply to the entire selection through SECURITY INVOKER.
CREATE FUNCTION public.set_workload_task_status(p_task_ids bigint[], p_status text)
RETURNS SETOF public.workload_tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  requested_count bigint;
  updated_count bigint;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending', 'in-progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'workload_task_status_required';
  END IF;
  SELECT count(DISTINCT id) INTO requested_count FROM unnest(p_task_ids) AS ids(id);
  RETURN QUERY
  UPDATE public.workload_tasks AS task
  SET status = p_status,
      completion_date = CASE
        WHEN p_status <> 'completed' THEN NULL
        WHEN task.status = 'completed' THEN task.completion_date
        ELSE (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      END
  WHERE task.id = ANY (p_task_ids)
  RETURNING task.*;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> requested_count THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'workload_task_status_selection_unavailable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_workload_task_status(bigint[], text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_workload_task_status(bigint[], text) TO authenticated;

-- Subscribe only to employee records visible through the existing employee RLS.
-- The client receives an invalidation and rereads tasks through their own RLS.
CREATE POLICY workload_task_broadcast_select ON realtime.messages
FOR SELECT TO authenticated
USING (
  extension = 'broadcast'
  AND topic = (SELECT realtime.topic())
  AND starts_with((SELECT realtime.topic()), 'hr:workload:')
  AND EXISTS (
    SELECT 1 FROM public.employees AS employee
    WHERE employee.id = substr((SELECT realtime.topic()), length('hr:workload:') + 1)
  )
);

CREATE FUNCTION private.broadcast_workload_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM realtime.send('{}'::jsonb, 'changed', 'hr:workload:' || NEW.employee_id, true);
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.employee_id IS DISTINCT FROM NEW.employee_id) THEN
    PERFORM realtime.send('{}'::jsonb, 'changed', 'hr:workload:' || OLD.employee_id, true);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.broadcast_workload_task_change() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER workload_task_broadcast_change
AFTER INSERT OR UPDATE OR DELETE ON public.workload_tasks
FOR EACH ROW EXECUTE FUNCTION private.broadcast_workload_task_change();
