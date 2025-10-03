import React, { useState } from 'react';
import { Calendar, Clock, Coffee, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const TimeTracking = ({ employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id || null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { isDarkMode, toggleTheme, button, bg, text, border, hover, input } = useTheme();
  const { t } = useLanguage();

  const timeTrackingData = {
    [employees[0]?.id]: {
      daysWorked: 22,
      leaveDays: 3,
      overtime: 15.5,
      holidayOvertime: 8,
      regularHours: 176,
      totalHours: 199.5
    },
    [employees[1]?.id]: {
      daysWorked: 20,
      leaveDays: 5,
      overtime: 12,
      holidayOvertime: 4,
      regularHours: 160,
      totalHours: 176
    },
    [employees[2]?.id]: {
      daysWorked: 23,
      leaveDays: 2,
      overtime: 18,
      holidayOvertime: 6,
      regularHours: 184,
      totalHours: 208
    }
  };

  const currentData = timeTrackingData[selectedEmployee] || {
    daysWorked: 0,
    leaveDays: 0,
    overtime: 0,
    holidayOvertime: 0,
    regularHours: 0,
    totalHours: 0
  };

  const months = [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'), 
    t('months.may'), t('months.june'), t('months.july'), t('months.august'), 
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ];

  const years = [2023, 2024, 2025];

  const TimeCard = ({ title, value, unit, icon: Icon, color, bgColor }) => (
    <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary}`}>{title}</p>
          <p className={`text-2xl font-bold ${color} mt-1`}>
            {value}
            <span className={`text-sm font-normal ${text.secondary} ml-1`}>{unit}</span>
          </p>
        </div>
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${text.primary}`}>{t('timeTracking.title')}</h2>
        <div className="flex space-x-4">
          {/* Employee Selector */}
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {employees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {months.map((month, index) => (
              <option key={index} value={index}>
                {month}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time Tracking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <TimeCard
          title={t('timeTracking.workDays')}
          value={currentData.daysWorked}
          unit={t('timeTracking.days')}
          icon={Calendar}
          color="text-blue-600"
          bgColor="bg-white"
        />
        <TimeCard
          title={t('timeTracking.leaveDays')}
          value={currentData.leaveDays}
          unit={t('timeTracking.days')}
          icon={Coffee}
          color="text-orange-600"
          bgColor="bg-white"
        />
        <TimeCard
          title={t('timeTracking.overtime')}
          value={currentData.overtime}
          unit={t('timeTracking.hours')}
          icon={Clock}
          color="text-purple-600"
          bgColor="bg-white"
        />
        <TimeCard
          title={t('timeTracking.holidayOvertime')}
          value={currentData.holidayOvertime}
          unit={t('timeTracking.hours')}
          icon={Zap}
          color="text-green-600"
          bgColor="bg-white"
        />
      </div>

      {/* Detailed Summary */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('timeTracking.summary', `Summary for ${employees.find(emp => emp.id == selectedEmployee)?.name} - ${months[selectedMonth]} ${selectedYear}`)}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.regularHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.regularHours} {t('timeTracking.hrs')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.overtimeHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.overtime} {t('timeTracking.hrs')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.totalHours')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.totalHours} {t('timeTracking.hrs')}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.workDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.daysWorked} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.leaveDays')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.leaveDays} {t('timeTracking.days')}</span>
            </div>
            <div className="flex justify-between">
              <span className={text.secondary}>{t('timeTracking.holidayOvertime')}:</span>
              <span className={`font-medium ${text.primary}`}>{currentData.holidayOvertime} {t('timeTracking.hrs')}</span>
            </div>
            <div className={`flex justify-between border-t ${border.primary} pt-3`}>
              <span className={`${text.primary} font-semibold`}>{t('timeTracking.attendanceRate')}:</span>
              <span className={`font-bold ${text.primary}`}>
                {((currentData.daysWorked / 25) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>{t('timeTracking.quickActions')}</h3>
        <div className="flex flex-wrap gap-3">
          <button className={`px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors`}
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}>
            {t('timeTrackingActions.recordTime')}
          </button>
          <button className={`px-4 py-2 rounded-lg hover:bg-green-700 transition-colors`}
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}>
            {t('timeTrackingActions.requestLeave')}
          </button>
          <button className={`px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors`}
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}>
            {t('timeTrackingActions.logOvertime')}
          </button>
          <button className={`px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors`}
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
            color: isDarkMode ? '#ffffff' : '#111827' // white : gray-900
          }}>
            {t('timeTrackingActions.exportReport')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeTracking;
