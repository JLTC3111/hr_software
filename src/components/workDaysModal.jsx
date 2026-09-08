import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Download, ArrowUp, ArrowDown, Calendar, Clock, Sunrise, Sunset, ClipboardCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Btn, ColumnHeading } from './ui/industry.jsx';
import { Spinner } from './ui/Spinner.jsx';

const WorkDaysModal = ({ isOpen, onClose, employeeId, month }) => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  const { handleSessionAuthError } = useAuth();

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
            const regularEntries = result.data.filter(entry => 
              entry.hour_type === 'regular' && entry.status === 'approved'
            );
            setTimeEntries(regularEntries);
          }
        } catch (error) {
          console.error("Error fetching time entries:", error);
          handleSessionAuthError(error, { silent: true });
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchTimeEntries();
  }, [isOpen, employeeId, month]);

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

  const thStyle = {
    textAlign: 'center',
    padding: '0 8px 8px',
    borderBottom: `1px solid ${ind.hairline}`,
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: ind.inkMuted,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUp size={11} strokeWidth={1.5} style={{ color: ind.inkFaint }} />;
    }
    return sortConfig.direction === 'ascending'
      ? <ArrowUp size={11} strokeWidth={1.5} />
      : <ArrowDown size={11} strokeWidth={1.5} />;
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,31,32,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div ref={modalContentRef} style={{ width: '100%', maxWidth: 896 }}>
        <Blueprint
          ind={ind}
          style={{
            background: ind.ground, display: 'flex', flexDirection: 'column',
            color: ind.ink, fontFamily: BODY, maxHeight: '90vh', overflow: 'hidden',
          }}
        >
          <div className="flex items-start justify-between" style={{ gap: 12, padding: '18px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div>
              <ColumnHeading ind={ind}>{t('workDaysModal.title', 'Work Days Details')}</ColumnHeading>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>
                {filteredTimeEntries.length} {t('workDaysModal.entries', 'entries')} · {totalHours.toFixed(1)} {t('workDaysModal.totalHours', 'total hours')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between" style={{ gap: 10, padding: '14px 20px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${ind.hairline}`, padding: '5px 10px', minWidth: 220, flex: '1 1 200px' }}>
              <Search size={14} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} />
              <input
                type="text"
                placeholder={t('workDaysModal.search', 'Search...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 13, width: '100%', padding: 0 }}
              />
            </label>
            <Btn ind={ind} variant="primary" onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} strokeWidth={1.5} />
              {t('workDaysModal.exportExcel', 'Export Excel')}
            </Btn>
          </div>

          <div style={{ overflowX: 'auto', flex: 1, padding: '0 20px 18px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13, textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => requestSort('date')}>
                    <div className="flex items-center justify-center" style={{ gap: 6 }}>
                      <Calendar size={12} strokeWidth={1.5} />
                      <span>{t('workDaysModal.date', 'Date')}</span>
                      <SortIcon columnKey="date" />
                    </div>
                  </th>
                  <th style={{ ...thStyle, cursor: 'default' }}>
                    <div className="flex items-center justify-center" style={{ gap: 6 }}>
                      <Sunrise size={12} strokeWidth={1.5} />
                      <span>{t('workDaysModal.clockIn', 'Clock In')}</span>
                    </div>
                  </th>
                  <th style={{ ...thStyle, cursor: 'default' }}>
                    <div className="flex items-center justify-center" style={{ gap: 6 }}>
                      <Sunset size={12} strokeWidth={1.5} />
                      <span>{t('workDaysModal.clockOut', 'Clock Out')}</span>
                    </div>
                  </th>
                  <th style={thStyle} onClick={() => requestSort('hours')}>
                    <div className="flex items-center justify-center" style={{ gap: 6 }}>
                      <Clock size={12} strokeWidth={1.5} />
                      <span>{t('workDaysModal.hours', 'Hours')}</span>
                      <SortIcon columnKey="hours" />
                    </div>
                  </th>
                  <th style={{ ...thStyle, cursor: 'default' }}>
                    <div className="flex items-center justify-center" style={{ gap: 6 }}>
                      <ClipboardCheck size={12} strokeWidth={1.5} />
                      <span>{t('workDaysModal.notes', 'Notes')}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 32 }}>
                      <Spinner ind={ind} size="block" />
                    </td>
                  </tr>
                ) : filteredTimeEntries.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 32, color: ind.inkMuted }}>
                      {t('workDaysModal.noData', 'No work days recorded for this period')}
                    </td>
                  </tr>
                ) : (
                  filteredTimeEntries.map((entry, index) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                      <td style={{ padding: '10px 8px', color: ind.ink, fontWeight: 500 }}>
                        {new Date(entry.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td style={{ padding: '10px 8px', color: ind.inkMuted }}>{entry.clock_in || '-'}</td>
                      <td style={{ padding: '10px 8px', color: ind.inkMuted }}>{entry.clock_out || '-'}</td>
                      <td style={{ padding: '10px 8px', ...figure(13, ind.ink) }}>
                        {entry.hours ? `${entry.hours.toFixed(1)}h` : '0.0h'}
                      </td>
                      <td style={{ padding: '10px 8px', color: ind.inkMuted, fontSize: 12.5 }}>{entry.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Blueprint>
      </div>
    </div>
  );
};

export default WorkDaysModal;
