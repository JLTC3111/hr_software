import React, { useMemo, useCallback, useState, memo } from 'react';
import { ChevronDown, Eye, Edit, Trash2, Mail, Phone, Star, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getDemoEmployeeName } from '../utils/demoHelper';

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');

const clampPerformance = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n));
};

const EmployeeRow = memo(function EmployeeRow({ employee, onViewDetails, onEdit, onDelete, canEditOrDelete }) {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const employeeStatus = String(employee?.status || 'pending');
  const employeeStatusKey = useMemo(() => normalizeKey(employeeStatus), [employeeStatus]);

  const employeePosition = String(employee?.position || '');
  const employeePositionKey = useMemo(() => normalizeKey(employeePosition), [employeePosition]);

  const performanceValue = useMemo(() => clampPerformance(employee?.performance), [employee?.performance]);

  const handleRowClick = useCallback(() => onViewDetails?.(employee), [onViewDetails, employee]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onViewDetails?.(employee);
      }
    },
    [onViewDetails, employee]
  );

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.(employee);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={`grid grid-cols-12 gap-3 items-center px-4 py-3 rounded-xl border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:bg-gray-800/70'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="col-span-12 sm:col-span-4 min-w-0 flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-full overflow-hidden flex items-center justify-center ${
            isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {employee?.photo ? (
            <img
              src={employee.photo}
              alt={String(employee?.name || t('employees.employee', 'Employee'))}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <User className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {getDemoEmployeeName(employee, t)}
          </div>
          <div className={`text-sm truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {employeePosition
              ? t(`employeePosition.${employeePositionKey}`, employeePosition)
              : t('common.notAvailable', 'N/A')}
          </div>
        </div>
      </div>

      <div className="col-span-12 sm:col-span-3 min-w-0 flex flex-col gap-1">
        <div className={`flex items-center gap-2 min-w-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <Mail className="h-4 w-4 opacity-70" />
          <span className="truncate" title={employee?.email || ''}>{employee?.email || t('common.notAvailable', 'N/A')}</span>
        </div>
        <div className={`flex items-center gap-2 min-w-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <Phone className="h-4 w-4 opacity-70" />
          <span className="truncate" title={employee?.phone || ''}>{employee?.phone || t('common.notAvailable', 'N/A')}</span>
        </div>
      </div>

      <div className="col-span-6 sm:col-span-2">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            isDarkMode ? 'bg-gray-700/60 text-gray-100' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {t(`employeeStatus.${employeeStatusKey}`, employeeStatus)}
        </span>
      </div>

      <div className="col-span-6 sm:col-span-2 flex items-center gap-1 justify-end sm:justify-start">
        {[1, 2, 3, 4, 5].map((idx) => (
          <Star
            key={idx}
            className={`h-3.5 w-3.5 ${idx <= Math.round(performanceValue)
              ? isDarkMode
                ? 'text-amber-300'
                : 'text-amber-500'
              : isDarkMode
                ? 'text-gray-600'
                : 'text-gray-300'
            }`}
            fill={idx <= Math.round(performanceValue) ? 'currentColor' : 'none'}
          />
        ))}
      </div>

      <div className="col-span-12 sm:col-span-1 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={stop(onViewDetails)}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode ? 'hover:bg-gray-700 text-gray-300 hover:text-white' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
          }`}
          title={t('employees.view', 'View Details')}
          aria-label={t('employees.view', 'View Details')}
        >
          <Eye className="h-4 w-4" />
        </button>

        {canEditOrDelete && (
          <>
            <button
              type="button"
              onClick={stop(onEdit)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-emerald-300'
                  : 'hover:bg-gray-200 text-gray-600 hover:text-emerald-700'
              }`}
              title={t('employees.edit', 'Edit')}
              aria-label={t('employees.edit', 'Edit')}
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={stop(onDelete)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'hover:bg-gray-700 text-gray-300 hover:text-rose-300'
                  : 'hover:bg-gray-200 text-gray-600 hover:text-rose-700'
              }`}
              title={t('employees.delete', 'Delete')}
              aria-label={t('employees.delete', 'Delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

const EmployeeDirectory = ({ employees, onViewDetails, onEdit, onDelete }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();

  const canEditOrDelete = user?.role === 'admin' || user?.role === 'hr';

  const grouped = useMemo(() => {
    const map = new Map();
    for (const employee of employees) {
      const key = employee?.department || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(employee);
    }

    // stable-ish ordering: larger groups first, then alpha
    return Array.from(map.entries())
      .map(([department, list]) => ({ department, list }))
      .sort((a, b) => (b.list.length - a.list.length) || String(a.department).localeCompare(String(b.department)));
  }, [employees]);

  const [collapsed, setCollapsed] = useState({});

  const toggle = useCallback((department) => {
    setCollapsed((prev) => ({ ...prev, [department]: !prev[department] }));
  }, []);

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-4 py-3 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {t('employees.results', 'Results')}: <span className="font-semibold">{employees.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {grouped.map(({ department, list }) => {
          const deptKey = normalizeKey(department);
          const isCollapsed = !!collapsed[department];

          return (
            <div key={department} className="space-y-2">
              <button
                type="button"
                onClick={() => toggle(department)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-800/70'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'} ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                  />
                  <div className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {t(`departments.${deptKey}`, department)}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                    {list.length}
                  </div>
                </div>
              </button>

              {!isCollapsed && (
                <div className="space-y-2">
                  {list.map((employee) => (
                    <EmployeeRow
                      key={employee.id}
                      employee={employee}
                      onViewDetails={onViewDetails}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      canEditOrDelete={canEditOrDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeDirectory;
