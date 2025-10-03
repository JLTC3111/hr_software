import React from 'react'
import { useState } from 'react';
import { Plus } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import SearchAndFilter from './search.jsx'
import EmployeeCard from './employeeCard.jsx'

const Employees = ({ employees, onViewEmployee, onPhotoUpdate, onAddEmployeeClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
  
  const departments = [
    t('departments.all'), 
    t('departments.engineering'), 
    t('departments.marketing'), 
    t('departments.sales'), 
    t('departments.humanresources'), 
    t('departments.design'), 
    t('departments.finance')
  ];

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-900">{t('employees.title')}</h2>
        <button 
          onClick={onAddEmployeeClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}>
          <Plus className="h-4 w-4" />
          <span>{t('employees.addEmployee')}</span>
        </button>
      </div>

      <SearchAndFilter 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterDepartment={filterDepartment}
        setFilterDepartment={setFilterDepartment}
        departments={departments}
        style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}
      />

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map(employee => (
          <EmployeeCard 
            key={employee.id} 
            employee={employee} 
            onViewDetails={onViewEmployee}
            onPhotoUpdate={onPhotoUpdate}
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
              color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Employees;
