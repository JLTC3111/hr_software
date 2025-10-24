import React, { useState, useEffect } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import SearchAndFilter from './search.jsx';
import EmployeeCard from './employeeCard.jsx';
import * as employeeService from '../services/employeeService';

const Employees = ({ employees, onViewEmployee, onEditEmployee, onDeleteEmployee, onPhotoUpdate, onAddEmployeeClick, refetchEmployees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
  
  // Refetch employees if coming from add employee page with refresh flag
  useEffect(() => {
    if (location.state?.refresh && refetchEmployees) {
      refetchEmployees();
      // Clear the state to prevent refetching on every render
      window.history.replaceState({}, document.title);
    }
  }, [location, refetchEmployees]);
  
  const departments = [
    t('departments.all'), 
    t('departments.engineering'), 
    t('departments.marketing'), 
    t('departments.sales'), 
    t('departments.humanresources'), 
    t('departments.design'), 
    t('departments.finance')
  ];

  // Separate active and inactive employees
  const activeEmployees = employees.filter(emp => emp.status !== 'Inactive' && emp.status !== 'inactive');
  const deletedEmployees = employees.filter(emp => emp.status === 'Inactive' || emp.status === 'inactive');

  const filteredEmployees = activeEmployees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const handleRestoreEmployee = async (employeeId) => {
    if (window.confirm(t('employees.confirmRestore', 'Are you sure you want to restore this employee?'))) {
      try {
        const result = await employeeService.updateEmployee(employeeId, {
          status: 'Active'
        });

        if (result.success) {
          refetchEmployees();
          alert(t('employees.restoreSuccess', 'Employee restored successfully!'));
        } else {
          alert(t('employees.restoreError', 'Failed to restore employee'));
        }
      } catch (error) {
        console.error('Error restoring employee:', error);
        alert(t('employees.restoreError', 'Failed to restore employee'));
      }
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 slide-in-left">
        <h2 className={`font-bold ${text.primary}`} style={{fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'}}>{t('employees.title')}</h2>
        <div className="flex items-center space-x-2">
          {deletedEmployees.length > 0 && (
            <button
              onClick={() => setShowDeletedModal(true)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#6b7280',
                color: '#ffffff'
              }}
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t('employees.viewDeleted', 'Restore')} ({deletedEmployees.length})</span>
            </button>
          )}
          <button 
          onClick={onAddEmployeeClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', 
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', 
            color: isDarkMode ? '#ffffff' : '#111827' 
          }}>
            <Plus className="h-4 w-4" />
            <span>{t('employees.addEmployee')}</span>
          </button>
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

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee, index) => (
          <div key={employee.id} className={`stagger-item slide-in-up`} style={{ animationDelay: `${index * 0.05}s` }}>
            <EmployeeCard 
              employee={employee} 
              onViewDetails={onViewEmployee}
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

      {/* Deleted Employees Modal */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in" onClick={() => setShowDeletedModal(false)}>
          <div 
            className="rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="p-4 border-b flex items-center justify-between"
              style={{
                borderColor: isDarkMode ? '#374151' : '#e5e7eb'
              }}
            >
              <h3 className="text-xl font-bold">{t('employees.deletedEmployees', 'Deleted Employees')}</h3>
              <button
                onClick={() => setShowDeletedModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deletedEmployees.map((employee) => (
                  <div 
                    key={employee.id}
                    className="rounded-lg border p-4"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
                      borderColor: isDarkMode ? '#4b5563' : '#e5e7eb'
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{employee.name}</h4>
                        <p className="text-sm opacity-70">{employee.position}</p>
                        <p className="text-xs opacity-60 mt-1">{employee.department}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        Deleted
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        handleRestoreEmployee(employee.id);
                        setShowDeletedModal(false);
                      }}
                      className="w-full mt-3 px-3 py-2 rounded-lg flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t('employees.restore', 'Restore')}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
