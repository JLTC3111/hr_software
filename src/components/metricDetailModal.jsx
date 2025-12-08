import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, ClockFading, CalendarClock, Coffee, ArrowUpDown, Calendar, IdCard, User, Briefcase, Clock, Network } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const MetricDetailModal = ({ isOpen, onClose, metricType, data, title }) => {
  const { isDarkMode, bg, text, border, input } = useTheme();
  const { t } = useLanguage();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterStatus, setFilterStatus] = useState('all');

  const modalContentRef = useRef(null);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (modalContentRef.current && !modalContentRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, isOpen]);

  // Department Color Tag
  function getDepartmentColor(department) {
    switch (department) {
      case 'technology':
        return 'bg-blue-100 text-blue-800';
      case 'finance':
        return 'bg-gray-100 text-gray-800';
      case 'human_resources':
        return 'bg-yellow-100 text-yellow-800';
      case 'board_of_directors':
        return 'bg-blue-600 text-green-100';
      case 'office_unit':
        return 'bg-pink-200 text-pink-900';
      case 'engineering':
        return 'bg-teal-900 text-teal-100';
      // Add more cases as needed
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  // Sort data
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    // Ensure every item has a position property, checking jobTitle and role as fallbacks
    let sortableData = data.map(item => ({
      ...item,
      position: item.position || item.jobTitle || item.role || 'employee',
    }));

    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return sortableData;
  }, [data, sortConfig]);

  // Filter data
  const filteredData = useMemo(() => {
    // Ensure every item has a position property (in case sortedData is mutated elsewhere)
    let filtered = sortedData.map(item => ({
      ...item,
      position: item.position || item.jobTitle || item.role || 'employee',
    }));

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => {
        return Object.values(item).some(val => 
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    return filtered;
  }, [sortedData, searchTerm, filterStatus]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;
    
    const headers = Object.keys(filteredData[0]);
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Render different table structures based on metric type
  const renderTable = () => {
    if (metricType === 'employees') {
      return (
        <table className="w-full">
          <thead>
            <tr className={`border-b ${border.primary}`}>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('employeeName')}>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{t('employees.name', 'Employee')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('department')}>
                <div className="flex items-center space-x-2">
                  <Network className="w-4 h-4" />
                  <span>{t('employees.department', 'Department')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('position')}>
                <div className="flex items-center space-x-2">
                  <IdCard className="w-4 h-4" />
                  <span>{t('employees.position', 'Position')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold`}>
                <span>{t('employees.status', 'Status')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <td className={`p-3 ${text.primary} font-medium`}>{item.employeeName}</td>
                <td className={`p-3 ${text.secondary}`}>
                  <span className={`px-2 py-1 ${getDepartmentColor(item.department)} rounded text-xs ${isDarkMode ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                    {t(`employeeDepartment.${item.department}`, item.department)}
                  </span>
                </td>
                <td className={`p-3 ${text.secondary}`}>
                  {t(`employeePosition.${item.position}`, item.position)}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'Active' || item.status === 'active' ? isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800' :
                    item.status === 'On Leave' || item.status === 'onLeave' ? isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800' :
                    item.status === 'Pending' || item.status === 'pending' ? isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800' :
                    item.status === 'Outsource Contractor' || item.status === 'outsourceContractor' ? isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800' :
                    item.status === 'Inactive' || item.status === 'inactive' ? isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800' : isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                  }`}>
                    {t(`employeeStatus.${item.status?.replace(/\s+/g, '').toLowerCase()}`, item.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (metricType === 'performance' || metricType === 'overtime' || metricType === 'leave') {
      return (
        <table className="w-full">
          <thead>
            <tr className={`border-b ${border.primary}`}>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('employeeName')}>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{t('employees.name', 'Employee')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('department')}>
                <div className="flex items-center justify-center space-x-2">
                  <Network className="w-4 h-4" />
                  <span>{t('employees.department', 'Department')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('position')}>
                <div className="flex items-center justify-center space-x-2">
                  <IdCard className="w-4 h-4" />
                  <span>{t('employees.position', 'Position')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              {metricType === 'performance' && (
                <th className={`p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('performance')}>
                  <div className="flex items-center justify-center space-x-2">
                    <span>{t('employees.performance', 'Performance')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
              )}
              {metricType === 'overtime' && (
                <th className={`p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('overtime')}>
                  <div className="flex items-center justify-center space-x-2">
                    <span>{t('dashboard.overtime', 'Overtime')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
              )}
              {metricType === 'leave' && (
                <th className={`p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('leaveDays')}>
                  <div className="flex items-center justify-center space-x-2">
                    <Coffee className="w-4 h-4" />
                    <span>{t('timeTracking.leaveDays', 'Leave Days')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <td className={`text-left p-3 ${text.primary} font-medium`}>{item.employeeName}</td>
                <td className={`text-center p-3 ${text.secondary}`}>
                  <span className={`px-2 py-1 ${getDepartmentColor(item.department)} rounded text-xs ${isDarkMode ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                    {t(`employeeDepartment.${item.department}`, item.department)}
                  </span>
                </td>
                 <td className={`text-center p-3 ${text.secondary}`}>
                  {t(`employeePosition.${item.position}`, item.position)}
                </td>
                {metricType === 'performance' && (
                  <td className={`text-center p-3 ${text.primary} font-semibold`}>{item.performance}/5.0</td>
                )}
                {metricType === 'overtime' && (
                  <td className={`text-center p-3 ${text.primary} font-semibold`}>{item.overtime}h</td>
                )}
                {metricType === 'leave' && (
                  <td className={`text-center p-3 ${text.primary} font-semibold`}>{item.leaveDays} {t('common.days', 'days')}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (metricType === 'workDays') {
      return (
        <table className="w-full">
          <thead>
            <tr className={`border-b ${border.primary}`}>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('employeeName')}>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{t('employees.name', 'Employee')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('department')}>
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4" />
                  <span>{t('employees.department', 'Department')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('workDays')}>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{t('dashboard.totalWorkDays', 'Work Days')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('overtime')}>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{t('dashboard.totalOvertime', 'Overtime')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <td className={`p-3 ${text.primary} font-medium`}>{item.employeeName}</td>
                <td className={`p-3 ${text.secondary}`}>
                  <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                    {t(`employeeDepartment.${item.department}`, item.department)}
                  </span>
                </td>
                <td className={`p-3 ${text.primary} font-semibold`}>{item.workDays} {t('common.days', 'days')}</td>
                <td className={`p-3 ${text.primary}`}>{item.overtime}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (metricType === 'pendingRequests') {
      return (
        <table className="w-full">
          <thead>
            <tr className={`border-b ${border.primary}`}>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('employeeName')}>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{t('employees.name', 'Employee')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('requestType')}>
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4" />
                  <span>{t('common.type', 'Type')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('date')}>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{t('timeClock.date', 'Date')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold`}>
                <span>{t('timeClock.status', 'Status')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <td className={`p-3 ${text.primary} font-medium`}>{item.employeeName}</td>
                <td className={`p-3 ${text.secondary}`}>
                  <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800'}`}>
                    {t(`timeTracking.${item.requestType}`, item.requestType)}
                  </span>
                </td>
                <td className={`p-3 ${text.primary}`}>{new Date(item.date).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'pending' ? isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800' :
                    item.status === 'approved' ? isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800' :
                    isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'
                  }`}>
                    {t(`timeTracking.status.${item.status}`, item.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (metricType === 'regularHours') {
      return (
        <table className="w-full">
          <thead>
            <tr className={`border-b ${border.primary}`}>
               <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('employeeName')}>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{t('employees.name', 'Employee')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-center p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('department')}>
                <div className="flex items-center justify-center space-x-2">
                  <Network className="w-4 h-4" />
                  <span>{t('employees.department', 'Department')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-center p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('regularHours')}>
                <div className="flex items-center justify-center space-x-2">
                  <ClockFading className="w-4 h-4" />
                  <span>{t('timeTracking.regularHours', 'Regular Hours')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th className={`text-center p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('totalHours')}>
                <div className="flex items-center justify-center space-x-2">
                  <CalendarClock className="w-4.5 h-4.5" />
                  <span>{t('timeTracking.totalHours', 'Total Hours')}</span>
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <td className={`p-3 ${text.primary} font-medium`}>{item.employeeName}</td>
                <td className={`text-center p-3 ${text.primary}`}>
                  <span className={`px-2 py-1 ${getDepartmentColor(item.department)} rounded text-xs ${isDarkMode ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>
                    {t(`employeeDepartment.${item.department}`, item.department || 'N/A')}
                  </span>
                </td>
                <td className={`text-center p-3 ${text.primary} font-semibold`}>
                  <span className={text.primary}>{item.regularHours || '0.0'} {t('timeTracking.hrs', 'hrs')}</span>
                </td>
                <td className={`text-center p-3 ${text.primary} font-semibold`}>
                  <span className={text.primary}>{item.totalHours || '0.0'} {t('timeTracking.hrs', 'hrs')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (metricType === 'applications') {
      return (
        <table className="w-full">
          <thead>
            <tr className={`border-b ${border.primary}`}>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('candidateName')}>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{t('recruitment.candidate', 'Candidate')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('position')}>
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4" />
                  <span>{t('recruitment.position', 'Position')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`} onClick={() => handleSort('appliedDate')}>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{t('recruitment.appliedDate', 'Applied Date')}</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className={`text-left p-3 ${text.primary} font-semibold`}>
                <span>{t('recruitment.status', 'Status')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <td className={`p-3 ${text.primary} font-medium`}>{item.candidateName}</td>
                <td className={`p-3 ${text.secondary}`}>
                  {item.positionKey ? t(item.positionKey, item.position) : item.position}
                </td>
                <td className={`p-3 ${text.primary}`}>
                  {item.appliedDate && !isNaN(new Date(item.appliedDate).getTime()) 
                    ? new Date(item.appliedDate).toLocaleDateString() 
                    : item.application_date && !isNaN(new Date(item.application_date).getTime())
                      ? new Date(item.application_date).toLocaleDateString()
                      : t('common.notAvailable', 'N/A')}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'Interview Scheduled' || item.status === 'interview scheduled' ? isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800' :
                    item.status === 'Under Review' || item.status === 'under review' ? isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800' :
                    isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                  }`}>
                    {t(`recruitment.status.${item.status?.toLowerCase().replace(/\s+/g, '')}`, item.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    
    return null;
  };

  // Early return after all hooks to avoid hooks violation
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div ref={modalContentRef} className={`relative ${bg.secondary} rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${border.primary}`}>
            <div>
              <h2 className={`text-2xl font-bold ${text.primary}`}>{title}</h2>
              <p className={`text-sm ${text.secondary} mt-1`}>
                {filteredData.length} {t('common.results', 'results')} • {t('dashboard.currentMonth', 'Current month')}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors cursor-pointer`}
            >
              <X className={`w-6 h-6 ${text.primary}`} />
            </button>
          </div>

          {/* Toolbar */}
          <div className={`p-4 border-b ${border.primary} space-y-3`}>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary}`} />
                <input
                  type="text"
                  placeholder={t('common.search', 'Search...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${input.className} ${isDarkMode ? 'text-white' : 'text-black'}`}
                />
              </div>

              {/* Export Button
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('reports.exportExcel', 'Export')}</span>
              </button> */}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {filteredData.length === 0 ? (
              <div className="text-center py-12">
                <p className={`${text.secondary} text-lg`}>{t('common.noData', 'No data available')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {renderTable()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricDetailModal;
