-- The admin time-clock ledger reads every page with an exact count. Previously
-- each scan resolved HR membership twice per attendance row. These two helpers
-- depend only on the caller, so scalar subqueries evaluate them once per query.
-- current_hr_role() checks active membership, including employment status; its
-- admin result is the same unrestricted branch in can_manage_employee(). Keep
-- the row-dependent manager check for everyone else.
ALTER POLICY time_entries_scoped_select ON public.time_entries
  USING (
    (SELECT private.current_hr_role()) = 'admin'
    OR employee_id = (SELECT private.current_employee_id())
    OR private.can_manage_employee(employee_id)
  );
