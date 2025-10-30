import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Download, ArrowUp, ArrowDown, Building, Calendar, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getWorkDaysForMonth } from '../services/timeTrackingService';
import { exportToExcel } from '../utils/exportUtils';

const WorkDaysModal = ({ isOpen, onClose, employeeId, month }) => {
  const { isDarkMode, bg, text, input, primary, card } = useTheme();
  const { t } = useLanguage();

  const [workDays, setWorkDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getWorkDaysForMonth(month, employeeId)
        .then(data => {
          setWorkDays(data);
          setLoading(false);
        })
        .catch(error => {
          console.error("Error fetching work days:", error);
          setLoading(false);
        });
    }
  }, [isOpen, employeeId, month]);

  const sortedWorkDays = useMemo(() => {
    let sortableItems = [...workDays];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [workDays, sortConfig]);

  const filteredWorkDays = sortedWorkDays.filter(day =>
    day.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    day.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const dataToExport = filteredWorkDays.map(day => ({
      [t('workDaysModal.name', 'Name')]: day.name,
      [t('workDaysModal.department', 'Department')]: day.department,
      [t('workDaysModal.totalWorkDays', 'Total Work Days')]: day.totalDays,
      [t('workDaysModal.totalOvertime', 'Total Overtime (h)')]: day.totalOvertime.toFixed(1),
    }));
    exportToExcel(dataToExport, `Work_Days_${month.toISOString().slice(0, 7)}`, `Work Days - ${month.toLocaleString('default', { month: 'long', year: 'numeric' })}`);
  };

  if (!isOpen) return null;

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUp size={14} className="text-gray-400" />;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className={`rounded-lg shadow-xl w-full max-w-4xl flex flex-col ${card.bg} ${text.primary}`}>
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">{t('workDaysModal.title', 'Work Days')}</h2>
            <p className={`${text.secondary} text-sm`}>
              {t('workDaysModal.results', '{count} results', { count: filteredWorkDays.length })} • {t('workDaysModal.currentMonth', 'Current month')}
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 flex justify-between items-center">
          <div className="relative w-full max-w-xs">
            <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${text.secondary}`} />
            <input
              type="text"
              placeholder={t('workDaysModal.search', 'Search...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${input.bg} ${input.border} ${input.text}`}
            />
          </div>
          <button
            onClick={handleExport}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-semibold transition-colors ${primary.bg} ${primary.hover_bg}`}
          >
            <Download size={18} />
            <span>{t('workDaysModal.exportExcel', 'Export Excel')}</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 px-4 py-2 border-b">
              <div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => requestSort('name')}
              >
                <Building size={16} className={text.secondary} />
                <span className="font-semibold">{t('workDaysModal.name', 'Name')}</span>
                <SortIcon columnKey="name" />
              </div>
              <div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => requestSort('department')}
              >
                <Building size={16} className={text.secondary} />
                <span className="font-semibold">{t('workDaysModal.department', 'Department')}</span>
                <SortIcon columnKey="department" />
              </div>
              <div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => requestSort('totalDays')}
              >
                <Calendar size={16} className={text.secondary} />
                <span className="font-semibold">{t('workDaysModal.totalWorkDays', 'Total Work Days')}</span>
                <SortIcon columnKey="totalDays" />
              </div>
              <div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => requestSort('totalOvertime')}
              >
                <Clock size={16} className={text.secondary} />
                <span className="font-semibold">{t('workDaysModal.totalOvertime', 'Total Overtime')}</span>
                <SortIcon columnKey="totalOvertime" />
              </div>
            </div>

            {/* Table Body */}
            {loading ? (
              <div className="p-4 text-center">{t('workDaysModal.loading', 'Loading...')}</div>
            ) : (
              <div className="divide-y">
                {filteredWorkDays.map((day, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 px-4 py-3 items-center">
                    <div className="font-medium">{day.name}</div>
                    <div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {day.department}
                      </span>
                    </div>
                    <div>{t('workDaysModal.days', '{count} days', { count: day.totalDays })}</div>
                    <div>{day.totalOvertime.toFixed(1)}h</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t text-center">
          <p className={`${text.secondary} text-xs`}>
            {t('workDaysModal.footer', 'Data for the current month')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkDaysModal;
