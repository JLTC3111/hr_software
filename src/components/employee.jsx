/**
 * /employees — the route shell around the directory screen.
 *
 * It used to carry a title, an Active/Inactive segment, a Cards/Directory
 * toggle, a search field and an Add button, and then hand what was left to the
 * directory, which drew its own. The directory now owns all of that: scope tabs
 * that carry their counts, one search field, one view toggle, and one primary
 * button. What is left here is the route's own work — refetching after an add,
 * and holding the full profile sheet the record links out to.
 */
import _React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import EmployeeDirectory from './employeeDirectory.jsx';
import EmployeeDetailModal from './employeeDetailModal.jsx';

const Employees = ({
  employees,
  onEditEmployee,
  onDeleteEmployee,
  onPhotoUpdate,
  refetchEmployees,
  loading = false,
}) => {
  const location = useLocation();
  const [profileEmployee, setProfileEmployee] = useState(null);

  // Coming back from "Add employee" carries a refresh flag; clear it so the
  // fetch does not repeat on every later render.
  useEffect(() => {
    if (location.state?.refresh && refetchEmployees) {
      refetchEmployees();
      globalThis.history.replaceState({}, document.title);
    }
  }, [location, refetchEmployees]);

  return (
    <div className="w-full min-w-0">
      <EmployeeDirectory
        employees={employees || []}
        loading={loading}
        onOpenProfile={setProfileEmployee}
        onEdit={onEditEmployee}
        onDelete={onDeleteEmployee}
        onPhotoUpdate={onPhotoUpdate}
      />

      {profileEmployee && (
        <EmployeeDetailModal
          employee={profileEmployee}
          onClose={() => setProfileEmployee(null)}
          onUpdate={refetchEmployees}
          onEdit={onEditEmployee}
        />
      )}
    </div>
  );
};

export default Employees;
