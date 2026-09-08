import _React, { useState, useEffect, useMemo } from 'react';
import { Trash2, AlertTriangle, Search, Filter, User, Shield, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as employeeService from '../services/employeeService.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { PageLiveClock } from './ui/page-live-clock';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Btn, Tag, Kicker, ColumnHeading, FlatListbox } from './ui/industry.jsx';
import { Spinner } from './ui/Spinner.jsx';

const ALLOWED_ROLES = ['admin', 'manager', 'general_manager'];

const DeleteEmployeeManager = () => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  const { user, handleSessionAuthError } = useAuth();
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    // Check user permissions
    const userRole = user?.user_metadata?.role || user?.role || 'employee';
    setHasPermission(ALLOWED_ROLES.includes(userRole.toLowerCase()));
    
    // Fetch all employees including inactive ones
    fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    setLoading(true);
    const result = await employeeService.getAllEmployees();
    if (result.success) {
      setEmployees(result.data);
    }
    setLoading(false);
  };

  const handlePermanentDelete = async (employee) => {
    const confirmMessage = t(
      'deleteEmployee.confirmPrompt',
      'PERMANENT DELETE WARNING\n\nYou are about to PERMANENTLY delete:\n\nEmployee: {name}\nEmail: {email}\n\nThis action:\n• Cannot be undone\n• Will remove ALL employee data\n• Will delete time tracking records\n• Will delete performance reviews\n• Will delete all associated files\n\nType "DELETE" to confirm this permanent action.'
    )
      .replace('{name}', employee.name)
      .replace('{email}', employee.email);
    
    const userInput = globalThis.prompt(confirmMessage);
    
    if (userInput === 'DELETE') {
      setDeleting(employee.id);
      try {
        const result = await employeeService.deleteEmployee(employee.id);
        
        if (result.success) {
          setEmployees(employees.filter(emp => emp.id !== employee.id));
          alert(t('deleteEmployee.deletedSuccess', '{name} has been permanently deleted from the system.').replace('{name}', employee.name));
        } else {
          console.error('Failed to delete employee:', result.error);
          alert(t('deleteEmployee.deleteFailed', 'Failed to delete employee.'));
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        if (handleSessionAuthError(error)) return;
        alert(t('deleteEmployee.unexpectedError', 'An unexpected error occurred during deletion.'));
      } finally {
        setDeleting(null);
      }
    } else if (userInput !== null) {
      alert(t('deleteEmployee.confirmKeyword', 'Deletion cancelled. You must type "DELETE" exactly to confirm.'));
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
                         emp.status.toLowerCase().replace(/\s+/g, '') === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Show permission denied if user doesn't have access
  if (!hasPermission) {
    return (
      <div style={{ padding: 24, color: ind.ink, fontFamily: BODY }}>
        <Blueprint ind={ind} style={{ background: ind.ground, padding: 32, textAlign: 'center' }}>
          <Shield size={22} strokeWidth={1.5} style={{ color: ind.inkMuted, margin: '0 auto 12px' }} />
          <ColumnHeading ind={ind}>{t('deleteEmployee.accessDenied', 'Access Denied')}</ColumnHeading>
          <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, margin: '8px 0 6px' }}>
            {t('deleteEmployee.permissionDenied', 'You do not have permission to access the Employee Deletion Manager.')}
          </p>
          <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkFaint }}>
            {t('deleteEmployee.requiredRoles', 'Required roles: Admin, HR Manager, or General Manager')}
          </p>
        </Blueprint>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, color: ind.ink, fontFamily: BODY }}>
      <Blueprint ind={ind} style={{ background: ind.ground, padding: 20, border: `1px solid ${ind.ink}` }}>
        <div className="flex items-start justify-between" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="flex items-start" style={{ gap: 12, minWidth: 0 }}>
            <AlertTriangle size={18} strokeWidth={1.5} style={{ color: ind.ink, marginTop: 2, flex: 'none' }} />
            <div>
              <ColumnHeading ind={ind}>{t('deleteEmployee.title', 'Employee Deletion Manager')}</ColumnHeading>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, marginTop: 8 }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 11 }}>
                  {t('deleteEmployee.dangerZone', 'Danger zone')}
                </span>
                {' · '}
                {t('deleteEmployee.dangerDescription', 'This tool permanently deletes employee data from the database.')}
              </p>
              <ul style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: '8px 0 0', paddingLeft: 16, lineHeight: 1.6 }}>
                <li>{t('deleteEmployee.warningCannotRecover', 'Deleted data cannot be recovered')}</li>
                <li>{t('deleteEmployee.warningRecordsRemoved', 'All associated records will be removed')}</li>
                <li>{t('deleteEmployee.warningUseInactive', 'Use "Inactive" status for soft deletion instead')}</li>
              </ul>
            </div>
          </div>
          <PageLiveClock
            showSeparator={false}
            loading={loading || Boolean(deleting)}
            isDarkMode={isDarkMode}
            fetchLabel={t('common.fetching', 'Fetching')}
          />
        </div>
      </Blueprint>

      <Blueprint ind={ind} style={{ background: ind.ground, padding: 16 }}>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${ind.hairline}`, padding: '6px 10px' }}>
            <Search size={14} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} />
            <input
              type="text"
              placeholder={t('deleteEmployee.searchPlaceholder', 'Search by name or email...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 13, width: '100%', padding: 0 }}
            />
          </label>
          <div style={{ position: 'relative' }}>
            <Filter size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: ind.inkMuted, pointerEvents: 'none' }} />
            <FlatListbox
              ind={ind}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t('deleteEmployee.allStatuses', 'All Status')}
              style={{ width: '100%', padding: '8px 12px 8px 32px', textTransform: 'none', letterSpacing: '.02em' }}
            >
              <option value="all">{t('deleteEmployee.allStatuses', 'All Status')}</option>
              <option value="active">{t('employeeStatus.active', 'Active')}</option>
              <option value="inactive">{t('employeeStatus.inactive', 'Inactive')}</option>
              <option value="onleave">{t('employeeStatus.onLeave', 'On Leave')}</option>
            </FlatListbox>
          </div>
        </div>
      </Blueprint>

      <Blueprint ind={ind} style={{ background: ind.ground }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
          <ColumnHeading ind={ind}>
            {t('deleteEmployee.employeeCount', 'Employees ({count})').replace('{count}', String(filteredEmployees.length))}
          </ColumnHeading>
        </div>

        {loading ? (
          <Spinner
            ind={ind}
            size="block"
            label={t('deleteEmployee.loading', 'Loading employees...')}
          />
        ) : filteredEmployees.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <User size={22} strokeWidth={1.5} style={{ color: ind.inkMuted, margin: '0 auto 8px' }} />
            <p style={{ color: ind.inkMuted }}>{t('deleteEmployee.noEmployees', 'No employees found')}</p>
          </div>
        ) : (
          <div>
            {filteredEmployees.map((employee) => {
              const statusKey = String(employee.status || '').toLowerCase().replace(/\s+/g, '');
              const statusVariant = statusKey === 'inactive' ? 'outline' : statusKey === 'onleave' ? 'neutral' : 'accent';
              return (
                <div
                  key={employee.id}
                  className="flex items-center justify-between"
                  style={{
                    gap: 16, padding: '14px 20px', borderTop: `1px solid ${ind.rule}`,
                    opacity: deleting === employee.id ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center" style={{ gap: 14, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 44, height: 44, flex: 'none', overflow: 'hidden',
                        border: `1px solid ${ind.hairline}`,
                        background: employee.photo ? 'transparent' : ind.accentWash,
                        display: 'grid', placeItems: 'center',
                      }}
                    >
                      {employee.photo ? (
                        <img src={employee.photo} alt={employee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={16} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {employee.name}
                      </div>
                      <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 4, fontSize: 12.5, color: ind.inkMuted }}>
                        <span>{employee.email}</span>
                        <Tag ind={ind} variant={statusVariant}>
                          {t(`employeeStatus.${statusKey}`, employee.status)}
                        </Tag>
                      </div>
                      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkFaint, marginTop: 4 }}>
                        {t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)} ·{' '}
                        {t(`departments.${String(employee.department).toLowerCase().replace(/\s+/g, '_')}`, employee.department)}
                      </p>
                    </div>
                  </div>
                  <Btn
                    ind={ind}
                    onClick={() => handlePermanentDelete(employee)}
                    disabled={deleting === employee.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: ind.ink, flex: 'none' }}
                  >
                    {deleting === employee.id ? (
                      <Spinner ind={ind} size="inline" />
                    ) : (
                      <Trash2 size={13} strokeWidth={1.5} />
                    )}
                    {deleting === employee.id
                      ? t('deleteEmployee.deleting', 'Deleting...')
                      : t('deleteEmployee.permanentDelete', 'Permanent Delete')}
                  </Btn>
                </div>
              );
            })}
          </div>
        )}
      </Blueprint>

      <Blueprint ind={ind} style={{ background: ind.ground, padding: 16 }}>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
          <CheckCircle size={15} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
          <Kicker ind={ind} color={ind.ink}>{t('deleteEmployee.softDeleteTitle', 'Recommended: Soft Delete')}</Kicker>
        </div>
        <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginBottom: 8 }}>
          {t('deleteEmployee.softDeleteDescription', 'For most cases, marking an employee as "Inactive" is recommended. This:')}
        </p>
        <ul style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
          <li>{t('deleteEmployee.softPreservesHistory', 'Preserves historical data and records')}</li>
          <li>{t('deleteEmployee.softAllowsAudits', 'Allows for future reference and audits')}</li>
          <li>{t('deleteEmployee.softReversible', 'Can be reversed if needed')}</li>
          <li>{t('deleteEmployee.softIntegrity', 'Maintains data integrity')}</li>
        </ul>

        <div className="flex items-center" style={{ gap: 8, margin: '16px 0 8px' }}>
          <XCircle size={15} strokeWidth={1.5} style={{ color: ind.ink }} />
          <Kicker ind={ind} color={ind.ink}>{t('deleteEmployee.permanentOnlyTitle', 'Use Permanent Delete Only When:')}</Kicker>
        </div>
        <ul style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
          <li>{t('deleteEmployee.permanentIncorrect', 'Employee data was entered incorrectly')}</li>
          <li>{t('deleteEmployee.permanentDuplicate', 'Duplicate records exist')}</li>
          <li>{t('deleteEmployee.permanentLegal', 'Legal requirement to remove data (GDPR, etc.)')}</li>
          <li>{t('deleteEmployee.permanentTestData', 'Test data needs to be cleaned up')}</li>
        </ul>
      </Blueprint>
    </div>
  );
};

export default DeleteEmployeeManager;
