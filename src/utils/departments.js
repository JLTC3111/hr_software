/**
 * The organisation's departments, in the order the forms present them.
 *
 * These are the values stored in `employees.department`, so anything that has to
 * know the full set — the Add Employee form, and the directory when it reports
 * which departments have nobody in them — reads it from here. Screens that only
 * list the departments people are actually in should keep deriving those from
 * the roster; this list is for the times "nobody works here" is itself the
 * answer, which a derived list can never give.
 *
 * Labels live in the translation bundles under both `departments.*` and
 * `employeeDepartment.*`; callers pick whichever namespace their screen uses.
 */
export const DEPARTMENT_KEYS = [
  'legal_compliance',
  'technology',
  'internal_affairs',
  'human_resources',
  'office_unit',
  'board_of_directors',
  'finance',
  'engineering',
  'sales',
  'marketing',
  'design',
  'part_time_employee',
];

export default DEPARTMENT_KEYS;
