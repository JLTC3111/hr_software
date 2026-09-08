import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, ClockFading, CalendarClock, Coffee, ArrowUpDown, Calendar, IdCard, User, Briefcase, Clock, Network } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Tag, ColumnHeading } from './ui/industry.jsx';

function statusVariant(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '');
  if (['inactive', 'rejected', 'declined'].includes(s)) return 'outline';
  if (['pending', 'onleave', 'underreview', 'interviewscheduled'].includes(s)) return 'neutral';
  return 'accent';
}

function Th({ ind, onClick, children, align = 'left' }) {
  return (
    <th
      onClick={onClick}
      style={{
        textAlign: align,
        padding: '0 8px 8px',
        borderBottom: `1px solid ${ind.hairline}`,
        fontFamily: DISPLAY,
        fontWeight: 600,
        fontSize: 10,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: ind.inkMuted,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </th>
  );
}

function Td({ ind, children, align = 'left', muted = false }) {
  return (
    <td
      style={{
        padding: '10px 8px',
        textAlign: align,
        color: muted ? ind.inkMuted : ind.ink,
        fontFamily: BODY,
        fontSize: 13,
      }}
    >
      {children}
    </td>
  );
}

function SortHead({ ind, icon: Icon, label, onClick, align = 'left' }) {
  return (
    <Th ind={ind} onClick={onClick} align={align}>
      <div className="inline-flex items-center" style={{ gap: 6 }}>
        {Icon ? <Icon size={12} strokeWidth={1.5} /> : null}
        <span>{label}</span>
        <ArrowUpDown size={11} strokeWidth={1.5} />
      </div>
    </Th>
  );
}

const MetricDetailModal = ({ isOpen, onClose, metricType, data, title }) => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const modalContentRef = useRef(null);

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

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
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

  const filteredData = useMemo(() => {
    let filtered = sortedData.map(item => ({
      ...item,
      position: item.position || item.jobTitle || item.role || 'employee',
    }));

    if (searchTerm) {
      filtered = filtered.filter(item => {
        return Object.values(item).some(val => 
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    return filtered;
  }, [sortedData, searchTerm]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const tableStyle = { width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 };

  const renderTable = () => {
    if (metricType === 'employees') {
      return (
        <table style={tableStyle}>
          <thead>
            <tr>
              <SortHead ind={ind} icon={User} label={t('employees.name', 'Employee')} onClick={() => handleSort('employeeName')} />
              <SortHead ind={ind} icon={Network} label={t('employees.department', 'Department')} onClick={() => handleSort('department')} />
              <SortHead ind={ind} icon={IdCard} label={t('employees.position', 'Position')} onClick={() => handleSort('position')} />
              <Th ind={ind}>{t('common.status', 'Status')}</Th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                <Td ind={ind}>{item.employeeName}</Td>
                <Td ind={ind} muted>{t(`employeeDepartment.${item.department}`, item.department)}</Td>
                <Td ind={ind} muted>{t(`employeePosition.${item.position}`, item.position)}</Td>
                <Td ind={ind}>
                  <Tag ind={ind} variant={statusVariant(item.status)}>
                    {t(`employeeStatus.${item.status?.replace(/\s+/g, '').toLowerCase()}`, item.status)}
                  </Tag>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (metricType === 'performance' || metricType === 'overtime' || metricType === 'leave') {
      return (
        <table style={tableStyle}>
          <thead>
            <tr>
              <SortHead ind={ind} icon={User} label={t('employees.name', 'Employee')} onClick={() => handleSort('employeeName')} />
              <SortHead ind={ind} icon={Network} label={t('employees.department', 'Department')} onClick={() => handleSort('department')} align="center" />
              <SortHead ind={ind} icon={IdCard} label={t('employees.position', 'Position')} onClick={() => handleSort('position')} align="center" />
              {metricType === 'performance' && (
                <SortHead ind={ind} label={t('employees.performance', 'Performance')} onClick={() => handleSort('performance')} align="center" />
              )}
              {metricType === 'overtime' && (
                <SortHead ind={ind} label={t('dashboard.overtime', 'Overtime')} onClick={() => handleSort('overtime')} align="center" />
              )}
              {metricType === 'leave' && (
                <SortHead ind={ind} icon={Coffee} label={t('timeTracking.leaveDays', 'Leave Days')} onClick={() => handleSort('leaveDays')} align="center" />
              )}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                <Td ind={ind}>{item.employeeName}</Td>
                <Td ind={ind} muted align="center">{t(`employeeDepartment.${item.department}`, item.department)}</Td>
                <Td ind={ind} muted align="center">{t(`employeePosition.${item.position}`, item.position)}</Td>
                {metricType === 'performance' && (
                  <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.performance}/5.0</span></Td>
                )}
                {metricType === 'overtime' && (
                  <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.overtime}h</span></Td>
                )}
                {metricType === 'leave' && (
                  <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.leaveDays} {t('common.days', 'days')}</span></Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (metricType === 'workDays') {
      return (
        <table style={tableStyle}>
          <thead>
            <tr>
              <SortHead ind={ind} icon={User} label={t('employees.name', 'Employee')} onClick={() => handleSort('employeeName')} />
              <SortHead ind={ind} icon={Briefcase} label={t('employees.department', 'Department')} onClick={() => handleSort('department')} align="center" />
              <SortHead ind={ind} icon={Calendar} label={t('dashboard.totalWorkDays', 'Work Days')} onClick={() => handleSort('workDays')} align="center" />
              <SortHead ind={ind} icon={Clock} label={t('dashboard.totalOvertime', 'Overtime')} onClick={() => handleSort('overtime')} align="center" />
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                <Td ind={ind}>{item.employeeName}</Td>
                <Td ind={ind} muted align="center">{t(`employeeDepartment.${item.department}`, item.department)}</Td>
                <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.workDays} {t('common.days', 'days')}</span></Td>
                <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.overtime}h</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (metricType === 'pendingRequests') {
      return (
        <table style={tableStyle}>
          <thead>
            <tr>
              <SortHead ind={ind} icon={User} label={t('employees.name', 'Employee')} onClick={() => handleSort('employeeName')} />
              <SortHead ind={ind} icon={Briefcase} label={t('common.type', 'Type')} onClick={() => handleSort('requestType')} />
              <SortHead ind={ind} icon={Calendar} label={t('timeClock.date', 'Date')} onClick={() => handleSort('date')} />
              <Th ind={ind}>{t('timeClock.status', 'Status')}</Th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                <Td ind={ind}>{item.employeeName}</Td>
                <Td ind={ind} muted>
                  <Tag ind={ind} variant="neutral">{t(`timeTracking.${item.requestType}`, item.requestType)}</Tag>
                </Td>
                <Td ind={ind}>{new Date(item.date).toLocaleDateString()}</Td>
                <Td ind={ind}>
                  <Tag ind={ind} variant={statusVariant(item.status)}>
                    {t(`timeTracking.statuses.${item.status}`, item.status)}
                  </Tag>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (metricType === 'regularHours') {
      return (
        <table style={tableStyle}>
          <thead>
            <tr>
              <SortHead ind={ind} icon={User} label={t('employees.name', 'Employee')} onClick={() => handleSort('employeeName')} />
              <SortHead ind={ind} icon={Network} label={t('employees.department', 'Department')} onClick={() => handleSort('department')} align="center" />
              <SortHead ind={ind} icon={ClockFading} label={t('timeTracking.regularHours', 'Regular Hours')} onClick={() => handleSort('regularHours')} align="center" />
              <SortHead ind={ind} icon={CalendarClock} label={t('timeTracking.totalHours', 'Total Hours')} onClick={() => handleSort('totalHours')} align="center" />
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                <Td ind={ind}>{item.employeeName}</Td>
                <Td ind={ind} muted align="center">{t(`employeeDepartment.${item.department}`, item.department || 'N/A')}</Td>
                <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.regularHours || '0.0'} {t('timeTracking.hrs', 'hrs')}</span></Td>
                <Td ind={ind} align="center"><span style={figure(13, ind.ink)}>{item.totalHours || '0.0'} {t('timeTracking.hrs', 'hrs')}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (metricType === 'applications') {
      return (
        <table style={tableStyle}>
          <thead>
            <tr>
              <SortHead ind={ind} icon={User} label={t('recruitment.candidate', 'Candidate')} onClick={() => handleSort('candidateName')} />
              <SortHead ind={ind} icon={Briefcase} label={t('recruitment.position', 'Position')} onClick={() => handleSort('position')} align="center" />
              <SortHead ind={ind} icon={Calendar} label={t('recruitment.appliedDate', 'Applied Date')} onClick={() => handleSort('appliedDate')} align="center" />
              <Th ind={ind} align="center">{t('recruitment.statusLabel', 'Status')}</Th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr key={index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                <Td ind={ind}>{item.candidateName}</Td>
                <Td ind={ind} muted align="center">
                  {item.positionKey ? t(item.positionKey, item.position) : item.position}
                </Td>
                <Td ind={ind} align="center">
                  {item.appliedDate && !isNaN(new Date(item.appliedDate).getTime()) 
                    ? new Date(item.appliedDate).toLocaleDateString() 
                    : item.application_date && !isNaN(new Date(item.application_date).getTime())
                      ? new Date(item.application_date).toLocaleDateString()
                      : t('common.notAvailable', 'N/A')}
                </Td>
                <Td ind={ind} align="center">
                  <Tag ind={ind} variant={statusVariant(item.status)}>
                    {t(`recruitmentStatus.${item.status?.toLowerCase().replace(/\s+/g, '')}`, item.status)}
                  </Tag>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    
    return null;
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, overflow: 'hidden' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(29,31,32,.55)' }}
        onClick={onClose}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div ref={modalContentRef} style={{ width: '100%', maxWidth: 1152, maxHeight: '90vh' }}>
          <Blueprint
            ind={ind}
            style={{
              background: ind.ground, display: 'flex', flexDirection: 'column',
              maxHeight: '90vh', overflow: 'hidden', color: ind.ink, fontFamily: BODY,
            }}
          >
            <div className="flex items-start justify-between" style={{ gap: 12, padding: '18px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
              <div>
                <ColumnHeading ind={ind}>{title}</ColumnHeading>
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>
                  {filteredData.length} {t('common.results', 'results')} · {t('dashboard.currentMonth', 'Current month')}
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

            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${ind.hairline}`, padding: '6px 10px' }}>
                <Search size={14} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} />
                <input
                  type="text"
                  placeholder={t('common.search', 'Search...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 13, width: '100%', padding: 0 }}
                />
              </label>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 20px' }}>
              {filteredData.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '48px 0', color: ind.inkMuted, fontFamily: BODY, fontSize: 14 }}>
                  {t('common.noData', 'No data available')}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {renderTable()}
                </div>
              )}
            </div>
          </Blueprint>
        </div>
      </div>
    </div>
  );
};

export default MetricDetailModal;
