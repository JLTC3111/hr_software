/**
 * Shared employee employment-status helpers.
 * Inactive = Inactive / inactive / terminated-style.
 * On Leave remains operationally active.
 */

export const EMPLOYEE_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
};

export function normalizeEmployeeStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function isInactiveToken(token) {
  return token === 'inactive' || token === 'terminated' || token === 'former';
}

/** True unless the employee is inactive/terminated. On Leave counts as active. */
export function isEmployeeActive(employee) {
  if (!employee) return false;
  if (employee.is_active === false || employee.isActive === false) return false;

  const status = normalizeEmployeeStatus(employee.status);
  const employmentStatus = normalizeEmployeeStatus(
    employee.employment_status ?? employee.employmentStatus
  );

  if (isInactiveToken(status) || isInactiveToken(employmentStatus)) return false;
  return true;
}

export function isEmployeeInactive(employee) {
  return !isEmployeeActive(employee);
}

export function filterActiveEmployees(employees = []) {
  return (employees || []).filter(isEmployeeActive);
}

export function filterInactiveEmployees(employees = []) {
  return (employees || []).filter(isEmployeeInactive);
}

export function partitionEmployeesByStatus(employees = []) {
  const active = [];
  const inactive = [];
  (employees || []).forEach((emp) => {
    if (isEmployeeActive(emp)) active.push(emp);
    else inactive.push(emp);
  });
  return { active, inactive };
}
