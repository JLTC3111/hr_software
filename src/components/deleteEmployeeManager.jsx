import _React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Search, Filter, User, Shield, Loader, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as employeeService from '../services/employeeService.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';
import { PageLiveClock } from './ui/page-live-clock';

const ALLOWED_ROLES = ['admin', 'manager', 'general_manager'];

const DeleteEmployeeManager = () => {
  const { isDarkMode, bg, text, border } = useTheme();
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
      '⚠️ PERMANENT DELETE WARNING ⚠️\n\nYou are about to PERMANENTLY delete:\n\nEmployee: {name}\nID: {id}\nEmail: {email}\n\nThis action:\n• Cannot be undone\n• Will remove ALL employee data\n• Will delete time tracking records\n• Will delete performance reviews\n• Will delete all associated files\n\nType "DELETE" to confirm this permanent action.'
    )
      .replace('{name}', employee.name)
      .replace('{id}', String(employee.id))
      .replace('{email}', employee.email);
    
    const userInput = globalThis.prompt(confirmMessage);
    
    if (userInput === 'DELETE') {
      setDeleting(employee.id);
      try {
        const result = await employeeService.deleteEmployee(employee.id);
        
        if (result.success) {
          setEmployees(employees.filter(emp => emp.id !== employee.id));
          alert(`✅ ${t('deleteEmployee.deletedSuccess', '{name} has been permanently deleted from the system.').replace('{name}', employee.name)}`);
        } else {
          console.error('Failed to delete employee:', result.error);
          alert(`❌ ${t('deleteEmployee.deleteFailed', 'Failed to delete employee.')}`);
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        if (handleSessionAuthError(error)) return;
        alert(`❌ ${t('deleteEmployee.unexpectedError', 'An unexpected error occurred during deletion.')}`);
      } finally {
        setDeleting(null);
      }
    } else if (userInput !== null) {
      alert(t('deleteEmployee.confirmKeyword', 'Deletion cancelled. You must type "DELETE" exactly to confirm.'));
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.id.toString().toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
                         emp.status.toLowerCase().replace(/\s+/g, '') === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Show permission denied if user doesn't have access
  if (!hasPermission) {
    return (
      <div className={`min-h-screen ${bg.primary} p-6`}>
        <div className={`${bg.secondary} rounded-lg shadow-lg p-8 border ${border.primary} w-full`}>
          <div className="text-center">
            <Shield className={`w-16 h-16 mx-auto mb-4 ${text.secondary}`} />
            <h2 className={`text-2xl font-bold ${text.primary} mb-2`}>{t('deleteEmployee.accessDenied', 'Access Denied')}</h2>
            <p className={`${text.secondary} mb-4`}>
              {t('deleteEmployee.permissionDenied', 'You do not have permission to access the Employee Deletion Manager.')}
            </p>
            <p className={`text-sm ${text.secondary}`}>
              {t('deleteEmployee.requiredRoles', 'Required roles: Admin, HR Manager, or General Manager')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg.primary} p-6`}>
      <div className="max-w-none w-full space-y-6">
        {/* Header with Warning */}
        <div className={`${bg.secondary} rounded-lg shadow-lg p-6 border-2 border-red-500`}>
          <div className="flex items-start space-x-4">
            <AlertTriangle className="w-8 h-8 text-red-600 shrink-0 mt-1" />
            <div className="flex flex-1 items-start justify-between gap-3 flex-wrap">
              <div>
              <h1 className={`text-2xl font-bold ${text.primary} mb-2`}>
                {t('deleteEmployee.title', 'Employee Deletion Manager')}
              </h1>
              <p className={`${text.secondary} mb-2`}>
                <strong className="text-red-600">{t('deleteEmployee.dangerZone', '⚠️ DANGER ZONE:')}</strong>{' '}
                {t('deleteEmployee.dangerDescription', 'This tool permanently deletes employee data from the database.')}
              </p>
              <ul className={`text-sm ${text.secondary} space-y-1 ml-4`}>
                <li>• {t('deleteEmployee.warningCannotRecover', 'Deleted data cannot be recovered')}</li>
                <li>• {t('deleteEmployee.warningRecordsRemoved', 'All associated records will be removed')}</li>
                <li>• {t('deleteEmployee.warningUseInactive', 'Use "Inactive" status for soft deletion instead')}</li>
              </ul>
              </div>
              <PageLiveClock
                showSeparator={false}
                textClassName={text.primary}
                loading={loading || Boolean(deleting)}
                isDarkMode={isDarkMode}
                fetchLabel={t('common.fetching', 'Fetching')}
              />
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary}`} />
              <input
                type="text"
                placeholder={t('deleteEmployee.searchPlaceholder', 'Search by name, email, or ID...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
            </div>
            <div className="relative">
              <Filter className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary}`} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer`}
              >
                <option value="all">{t('deleteEmployee.allStatuses', 'All Status')}</option>
                <option value="active">{t('employeeStatus.active', 'Active')}</option>
                <option value="inactive">{t('employeeStatus.inactive', 'Inactive')}</option>
                <option value="onleave">{t('employeeStatus.onLeave', 'On Leave')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary}`}>
          <div className="p-4 border-b ${border.primary}">
            <h2 className={`text-lg font-semibold ${text.primary}`}>
              {t('deleteEmployee.employeeCount', 'Employees ({count})').replace('{count}', String(filteredEmployees.length))}
            </h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <Loader className={`w-8 h-8 animate-spin ${text.secondary} mx-auto mb-2`} />
              <p className={text.secondary}>{t('deleteEmployee.loading', 'Loading employees...')}</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <User className={`w-12 h-12 ${text.secondary} mx-auto mb-2 opacity-50`} />
              <p className={text.secondary}>{t('deleteEmployee.noEmployees', 'No employees found')}</p>
            </div>
          ) : (
            <div className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredEmployees.map((employee) => (
                <div 
                  key={employee.id}
                  className={`p-4 transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} ${
                    deleting === employee.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        {employee.photo ? (
                          <img 
                            src={employee.photo} 
                            alt={employee.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${text.primary}`}>{employee.name}</h3>
                        <div className="flex items-center space-x-3 text-sm">
                          <span className={text.secondary}>{employee.email}</span>
                          <span className={text.secondary}>•</span>
                          <span className={text.secondary}>{t('employees.id', 'ID')}: {employee.id}</span>
                          <span className={text.secondary}>•</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            employee.status === 'Active' ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800') :
                            employee.status === 'Inactive' ? (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800') :
                            (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800')
                          }`}>
                            {t(`employeeStatus.${employee.status.toLowerCase().replace(/\s+/g, '')}`, employee.status)}
                          </span>
                        </div>
                        <p className={`text-sm ${text.secondary} mt-1`}>
                          {t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)} •{' '}
                          {t(`departments.${String(employee.department).toLowerCase().replace(/\s+/g, '_')}`, employee.department)}
                        </p>
                      </div>
                    </div>
                    <button
                    type ="button"
                      onClick={() => handlePermanentDelete(employee)}
                      disabled={deleting === employee.id}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                        deleting === employee.id
                          ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
                      }`}
                    >
                      {deleting === employee.id ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>{t('deleteEmployee.deleting', 'Deleting...')}</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>{t('deleteEmployee.permanentDelete', 'Permanent Delete')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4`}>
          <h3 className={`font-semibold ${text.primary} mb-2 flex items-center`}>
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            {t('deleteEmployee.softDeleteTitle', 'Recommended: Soft Delete')}
          </h3>
          <p className={`text-sm ${text.secondary} mb-3`}>
            {t('deleteEmployee.softDeleteDescription', 'For most cases, marking an employee as "Inactive" is recommended. This:')}
          </p>
          <ul className={`text-sm ${text.secondary} space-y-1 ml-6`}>
            <li>• {t('deleteEmployee.softPreservesHistory', 'Preserves historical data and records')}</li>
            <li>• {t('deleteEmployee.softAllowsAudits', 'Allows for future reference and audits')}</li>
            <li>• {t('deleteEmployee.softReversible', 'Can be reversed if needed')}</li>
            <li>• {t('deleteEmployee.softIntegrity', 'Maintains data integrity')}</li>
          </ul>
          
          <h3 className={`font-semibold ${text.primary} mt-4 mb-2 flex items-center`}>
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
            {t('deleteEmployee.permanentOnlyTitle', 'Use Permanent Delete Only When:')}
          </h3>
          <ul className={`text-sm ${text.secondary} space-y-1 ml-6`}>
            <li>• {t('deleteEmployee.permanentIncorrect', 'Employee data was entered incorrectly')}</li>
            <li>• {t('deleteEmployee.permanentDuplicate', 'Duplicate records exist')}</li>
            <li>• {t('deleteEmployee.permanentLegal', 'Legal requirement to remove data (GDPR, etc.)')}</li>
            <li>• {t('deleteEmployee.permanentTestData', 'Test data needs to be cleaned up')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DeleteEmployeeManager;
