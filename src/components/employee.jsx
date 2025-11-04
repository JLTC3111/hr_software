import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import SearchAndFilter from './search.jsx';
import EmployeeCard from './employeeCard.jsx';
import EmployeeDetailModal from './employeeDetailModal.jsx';

const Employees = ({ employees, onViewEmployee, onEditEmployee, onDeleteEmployee, onPhotoUpdate, refetchEmployees }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
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
      window.history.replaceState({}, document.title);
    }
  }, [location, refetchEmployees]);
  
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
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 slide-in-left">
        <h2 className={`font-bold ${text.primary}`} style={{fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'}}>{t('employees.title')}</h2>
        {canAddEmployee && (
          <button 
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

      {/* Employee Cards */}
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
                backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
                borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
                color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
              }}
            />
          </div>
        ))}
      </div>

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
