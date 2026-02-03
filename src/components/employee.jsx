import _React, { useState, useEffect } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import SearchAndFilter from './search.jsx';
import EmployeeCard from './employeeCard.jsx';
import EmployeeDirectory from './employeeDirectory.jsx';
import EmployeeDetailModal from './employeeDetailModal.jsx';

const Employees = ({ employees, onEditEmployee, onDeleteEmployee, onPhotoUpdate, refetchEmployees }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return globalThis.localStorage.getItem('employeesViewMode') || 'cards';
    } catch {
      return 'cards';
    }
  });
  const location = useLocation();
  const { t } = useLanguage();
  const { isDarkMode, _bg, text, _border } = useTheme();
  const { user } = useAuth();

  // Check if user has permission to add employees (not employee role)
  const canAddEmployee = user?.role !== 'employee';

  const handleCardClick = (employee) => {
    setSelectedEmployee(employee);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedEmployee(null);
  };

  const handleDetailModalUpdate = () => {
    if (refetchEmployees) {
      refetchEmployees();
    }
  };
  
  // Refetch employees if coming from add employee page with refresh flag
  useEffect(() => {
    if (location.state?.refresh && refetchEmployees) {
      refetchEmployees();
      // Clear the state to prevent refetching on every render
      globalThis.history.replaceState({}, document.title);
    }
  }, [location, refetchEmployees]);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem('employeesViewMode', viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);
  
  const departments = [
    { key: 'all', label: t('departments.all') },
    { key: 'legal_compliance', label: t('departments.legal_compliance') },
    { key: 'technology', label: t('departments.technology') },
    { key: 'internal_affairs', label: t('departments.internal_affairs') },
    { key: 'human_resources', label: t('departments.human_resources') },
    { key: 'office_unit', label: t('departments.office_unit') },
    { key: 'board_of_directors', label: t('departments.board_of_directors') },
    { key: 'finance', label: t('departments.finance') },
    { key: 'engineering', label: t('departments.engineering') },
    { key: 'sales', label: t('departments.sales') },
    { key: 'marketing', label: t('departments.marketing') },
    { key: 'design', label: t('departments.design') },
    { key: 'part_time_employee', label: t('departments.part_time_employee') }
  ];

  // Filter active employees only
  const filteredEmployees = (employees || []).filter(emp => {
    const name = (emp?.name || '').toLowerCase();
    const position = (emp?.position || '').toLowerCase();
    const department = (emp?.department || '').toLowerCase();
    const q = (searchTerm || '').toLowerCase();

    const matchesSearch = name.includes(q) || position.includes(q) || department.includes(q);
    const matchesDepartment = filterDepartment === 'all' || emp?.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 slide-in-left">
        <h2 className={`font-bold ${text.primary}`} style={{fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'}}>{t('employees.title')}</h2>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className={`inline-flex rounded-lg border overflow-hidden ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                viewMode === 'cards'
                  ? isDarkMode
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-900 text-white'
                  : isDarkMode
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={t('employees.viewCards', 'Card view')}
              aria-label={t('employees.viewCards', 'Card view')}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">{t('employees.cards', 'Cards')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('directory')}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                viewMode === 'directory'
                  ? isDarkMode
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-900 text-white'
                  : isDarkMode
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={t('employees.viewDirectory', 'Directory view')}
              aria-label={t('employees.viewDirectory', 'Directory view')}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{t('employees.directory', 'Directory')}</span>
            </button>
          </div>

          {canAddEmployee && (
            <button 
              type ="button"
              onClick={() => navigate('/employees/add')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{
                backgroundColor: isDarkMode ? '#374151' : '#ffffff', 
                borderColor: isDarkMode ? '#4b5563' : '#d1d5db', 
                color: isDarkMode ? '#ffffff' : '#111827' 
              }}>
                <Plus className="h-4 w-4" />
                <span>{t('employees.addEmployee')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="fade-in">
        <SearchAndFilter 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterDepartment={filterDepartment}
          setFilterDepartment={setFilterDepartment}
          departments={departments}
          style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff', 
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db', 
              color: isDarkMode ? '#ffffff' : '#111827',
            }}
        />
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee, index) => (
            <div key={employee.id} className={`stagger-item slide-in-up`} style={{ animationDelay: `${index * 0.05}s` }}>
              <EmployeeCard 
                employee={employee} 
                onViewDetails={handleCardClick}
                onEdit={onEditEmployee}
                onDelete={onDeleteEmployee}
                onPhotoUpdate={onPhotoUpdate}
                style={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#f8fafc',
                  borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmployeeDirectory
          employees={filteredEmployees}
          onViewDetails={handleCardClick}
          onEdit={onEditEmployee}
          onDelete={onDeleteEmployee}
        />
      )}

      {/* Employee Detail Modal */}
      {showDetailModal && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={handleCloseDetailModal}
          onUpdate={handleDetailModalUpdate}
          onEdit={onEditEmployee}
        />
      )}
    </div>
  );
};

export default Employees;
