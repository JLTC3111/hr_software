import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Download, ArrowUp, ArrowDown, Calendar, Clock, Loader, Sunrise, Sunset, ClipboardCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as timeTrackingService from '../services/timeTrackingService';

const WorkDaysModal = ({ isOpen, onClose, employeeId, month }) => {
  const { isDarkMode, bg, text, input, border } = useTheme();
  const { t } = useLanguage();

  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });
  
  const modalContentRef = useRef(null);

  useEffect(() => {
    const fetchTimeEntries = async () => {
      if (isOpen && employeeId && month) {
        setLoading(true);
        try {
          const year = month.getFullYear();
          const monthNum = month.getMonth() + 1;
          const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
          const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
          
          const result = await timeTrackingService.getTimeEntries(employeeId, {
            startDate: startDate,
            endDate: endDate
          });
          
          if (result.success) {
            // Filter only regular work hours (not weekend/holiday overtime)
            const regularEntries = result.data.filter(entry => 
              entry.hour_type === 'regular' && entry.status === 'approved'
            );
            setTimeEntries(regularEntries);
          }
        } catch (error) {
          console.error("Error fetching time entries:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchTimeEntries();
  }, [isOpen, employeeId, month]);

  // Handle ESC key press and click outside to close modal
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
  }, [isOpen, onClose]);

  const sortedTimeEntries = useMemo(() => {
    let sortableItems = [...timeEntries];
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
  }, [timeEntries, sortConfig]);

  const filteredTimeEntries = sortedTimeEntries.filter(entry =>
    entry.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.notes && entry.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const totalHours = filteredTimeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const monthStr = month ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}` : 'data';
    const csvContent = [
      ['Date', 'Clock In', 'Clock Out', 'Hours', 'Notes'].join(','),
      ...filteredTimeEntries.map(entry => [
        entry.date,
        entry.clock_in || '',
        entry.clock_out || '',
        entry.hours ? entry.hours.toFixed(1) : '0.0',
        entry.notes || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `work_days_${monthStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <div ref={modalContentRef} className={`rounded-lg shadow-xl w-full max-w-4xl flex flex-col ${bg.secondary} ${text.primary}`}>
        {/* Header */}
        <div className={`p-4 border-b ${border.primary} flex justify-between items-center`}>
          <div>
            <h2 className={`text-xl font-bold ${text.primary}`}>{t('workDaysModal.title', 'Work Days Details')}</h2>
            <p className={`${text.secondary} text-sm`}>
              {filteredTimeEntries.length} {t('workDaysModal.entries', 'entries')} • {totalHours.toFixed(1)} {t('workDaysModal.totalHours', 'total hours')}
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
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-semibold transition-colors bg-blue-600 hover:bg-blue-700"
          >
            <Download size={18} />
            <span>{t('workDaysModal.exportExcel', 'Export Excel')}</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto text-center flex-1">
          <table className="w-full">
            <thead className={`border-b ${border.primary}`}>
              <tr classname="flex items-center justify-center text-center"> 
                <th 
                  className={`py-3 px-4 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  onClick={() => requestSort('date')}
                >
                  <div className="flex space-x-2 items-center justify-center">
                    <Calendar size={16} />
                    <span>{t('workDaysModal.date', 'Date')}</span>
                  </div>
                </th>
                <th className={`py-3 px-4 ${text.primary} font-semibold`}>
                  <div className="flex justify-center items-center space-x-2">
                    <Sunrise size={16} />
                    <span>{t('workDaysModal.clockIn', 'Clock In')}</span>
                  </div>
                </th>
                <th className={`py-3 px-4 ${text.primary} font-semibold`}>
                  <div className="flex justify-center items-center space-x-2">
                    <Sunset size={16} />
                    <span>{t('workDaysModal.clockOut', 'Clock Out')}</span>
                  </div>
                </th>
                <th 
                  className={`py-3 px-4 ${text.primary} font-semibold cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  onClick={() => requestSort('hours')}
                >
                  <div className="flex justify-center items-center space-x-2">
                    <Clock size={16} />
                    <span>{t('workDaysModal.hours', 'Hours')}</span>
                  </div>
                </th>
                <th 
                  className={`py-3 px-4 ${text.primary} font-semibold`}>
                  <div className="flex justify-center items-center space-x-2">
                    <ClipboardCheck size={16} />
                    <span>{t('workDaysModal.notes', 'Notes')}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader className="w-5 h-5 animate-spin text-blue-600" />
                      <span className={text.secondary}>{t('common.loading', 'Loading...')}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTimeEntries.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center">
                    <span className={text.secondary}>{t('workDaysModal.noData', 'No work days recorded for this period')}</span>
                  </td>
                </tr>
              ) : (
                filteredTimeEntries.map((entry, index) => (
                  <tr key={index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className={`py-3 px-4 ${text.primary} font-medium`}>
                      {new Date(entry.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </td>
                    <td className={`py-3 px-4 ${text.secondary}`}>{entry.clock_in || '-'}</td>
                    <td className={`py-3 px-4 ${text.secondary}`}>{entry.clock_out || '-'}</td>
                    <td className={`py-3 px-4 ${text.primary} font-semibold`}>
                      {entry.hours ? `${entry.hours.toFixed(1)}h` : '0.0h'}
                    </td>
                    <td className={`py-3 px-4 ${text.secondary} text-sm`}>{entry.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WorkDaysModal;
