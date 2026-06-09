import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  Clock,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  Hourglass,
  Plane,
  Stethoscope,
  User,
  Loader,
  CheckCircle,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';
import { isDemoMode, getDemoEmployeeName, updateDemoLeaveRequest } from '../utils/demoHelper';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Local-safe date key (avoids UTC off-by-one)
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const normalize = (value) => (value || '').toString().slice(0, 10);

const LeaveManagement = ({ employees = [] }) => {
  const { bg, text, border, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();

  const canViewAll = checkPermission('canViewReports');
  const myEmployeeId = String(user?.employeeId || user?.id || '');

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState(canViewAll ? 'all' : 'mine'); // 'all' | 'mine'
  const [typeFilter, setTypeFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const flash = useCallback((setter, message) => {
    setter(message);
    setTimeout(() => setter(''), 3500);
  }, []);

  const fetchData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    try {
      let result;
      if (canViewAll && scope === 'all') {
        result = await timeTrackingService.getAllLeaveRequests({});
      } else {
        result = await timeTrackingService.getLeaveRequests(myEmployeeId, {});
      }
      if (result.success) {
        setLeaveRequests(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      handleSessionAuthError(error, { silent });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canViewAll, scope, myEmployeeId, handleSessionAuthError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAuthenticatedPageRefresh(() => fetchData({ silent: true }));

  // ---- Leave type styling ----
  const leaveTypeMeta = useMemo(() => ({
    vacation: { label: t('timeTracking.vacation', 'Vacation'), Icon: Plane, dot: 'bg-blue-500', chip: isDarkMode ? 'bg-blue-900/50 text-blue-200 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300' },
    sick: { label: t('timeTracking.sickLeave', 'Sick Leave'), Icon: Stethoscope, dot: 'bg-rose-500', chip: isDarkMode ? 'bg-rose-900/50 text-rose-200 border-rose-700' : 'bg-rose-100 text-rose-800 border-rose-300' },
    personal: { label: t('timeTracking.personal', 'Personal Leave'), Icon: User, dot: 'bg-purple-500', chip: isDarkMode ? 'bg-purple-900/50 text-purple-200 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-300' },
    other: { label: t('leave.other', 'Other'), Icon: CalendarDays, dot: 'bg-gray-500', chip: isDarkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-300' },
  }), [t, isDarkMode]);

  const metaFor = useCallback((type) => leaveTypeMeta[type] || leaveTypeMeta.other, [leaveTypeMeta]);

  const employeeName = useCallback((req) => {
    if (req.employee?.name) return getDemoEmployeeName(req.employee, t);
    const emp = employees.find(e => String(e.id) === String(req.employee_id));
    return emp ? getDemoEmployeeName(emp, t) : t('taskReview.unknown', 'Unknown');
  }, [employees, t]);

  // ---- Filtered requests ----
  const visibleRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      if (typeFilter !== 'all' && req.leave_type !== typeFilter) return false;
      if (canViewAll && scope === 'all' && employeeFilter !== 'all' && String(req.employee_id) !== String(employeeFilter)) return false;
      return true;
    });
  }, [leaveRequests, typeFilter, employeeFilter, canViewAll, scope]);

  const requestsForDay = useCallback((key) => {
    return visibleRequests.filter(req => {
      const s = normalize(req.start_date);
      const e = normalize(req.end_date || req.start_date);
      return key >= s && key <= e;
    });
  }, [visibleRequests]);

  // ---- Calendar grid (6 weeks) ----
  const weeks = useMemo(() => {
    const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startOffset);

    const todayKey = toKey(new Date());
    const result = [];
    const cursor = new Date(gridStart);
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const key = toKey(cursor);
        row.push({
          key,
          date: new Date(cursor),
          day: cursor.getDate(),
          inMonth: cursor.getMonth() === currentMonth.getMonth(),
          isToday: key === todayKey,
          isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(row);
    }
    return result;
  }, [currentMonth]);

  const inSelection = useCallback((key) => {
    if (!selStart) return false;
    if (!selEnd) return key === selStart;
    return key >= selStart && key <= selEnd;
  }, [selStart, selEnd]);

  const handleDayClick = (key) => {
    if (!selStart || (selStart && selEnd)) {
      // start a new selection
      setSelStart(key);
      setSelEnd(null);
    } else if (key < selStart) {
      setSelStart(key);
    } else {
      setSelEnd(key);
    }
  };

  const openRequestForSelection = () => {
    if (!selStart) {
      flash(setErrorMessage, t('leave.selectDatesFirst', 'Click a start and end date on the calendar first.'));
      return;
    }
    setShowRequestModal(true);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };
  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // ---- Stats ----
  const stats = useMemo(() => {
    const year = currentMonth.getFullYear();
    let pending = 0;
    let approvedDays = 0;
    const byType = {};
    visibleRequests.forEach(req => {
      if (req.status === 'pending') pending += 1;
      const days = Number(req.days_count) || 0;
      if (req.status === 'approved' && normalize(req.start_date).startsWith(String(year))) {
        approvedDays += days;
      }
      byType[req.leave_type] = (byType[req.leave_type] || 0) + 1;
    });
    return { pending, approvedDays, total: visibleRequests.length, byType };
  }, [visibleRequests, currentMonth]);

  // ---- Admin actions ----
  const refreshAfterMutation = () => fetchData({ silent: true });

  const handleApprove = async (req) => {
    try {
      if (isDemoMode()) {
        updateDemoLeaveRequest(req.id, { status: 'approved', approved_by: myEmployeeId });
      } else {
        const result = await timeTrackingService.updateLeaveRequestStatus(req.id, 'approved', myEmployeeId);
        if (!result.success) throw new Error(result.error);
      }
      setLeaveRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
      flash(setSuccessMessage, t('leave.requestApproved', 'Leave request approved.'));
      refreshAfterMutation();
    } catch (error) {
      console.error('Error approving leave:', error);
      if (handleSessionAuthError(error)) return;
      flash(setErrorMessage, t('errors.updateFailed', 'Failed to update status'));
    }
  };

  const handleReject = async (req) => {
    const reason = window.prompt(t('leave.rejectReasonPrompt', 'Reason for rejecting this request (optional):'), '');
    if (reason === null) return; // cancelled
    try {
      if (isDemoMode()) {
        updateDemoLeaveRequest(req.id, { status: 'rejected', approved_by: myEmployeeId, rejection_reason: reason || null });
      } else {
        const result = await timeTrackingService.updateLeaveRequestStatus(req.id, 'rejected', myEmployeeId, reason || null);
        if (!result.success) throw new Error(result.error);
      }
      setLeaveRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected', rejection_reason: reason || null } : r));
      flash(setSuccessMessage, t('leave.requestRejected', 'Leave request rejected.'));
      refreshAfterMutation();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      if (handleSessionAuthError(error)) return;
      flash(setErrorMessage, t('errors.updateFailed', 'Failed to update status'));
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'approved': return isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800';
      case 'rejected': return isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-800';
      default: return isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-800';
    }
  };

  const isAdmin = canViewAll;

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className={`p-4 rounded-lg border-l-4 border-green-500 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'} flex items-center space-x-2`}>
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className={`font-medium ${text.primary}`}>{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className={`p-4 rounded-lg border-l-4 border-red-500 ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'} flex items-center space-x-2`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className={`font-medium ${text.primary}`}>{errorMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${text.primary}`}>{t('nav.leaveManagement', 'Leave Management')}</h2>
          <p className={`text-sm ${text.secondary} mt-1`}>{t('leave.subtitle', 'Plan, request and approve time off on a shared calendar.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <div className={`flex rounded-lg border ${border.primary} overflow-hidden`}>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${scope === 'all' ? 'bg-blue-600 text-white' : `${bg.secondary} ${text.secondary}`}`}
              >
                {t('leave.everyone', 'Everyone')}
              </button>
              <button
                onClick={() => setScope('mine')}
                className={`px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${scope === 'mine' ? 'bg-blue-600 text-white' : `${bg.secondary} ${text.secondary}`}`}
              >
                {t('leave.mine', 'My Leave')}
              </button>
            </div>
          )}
          <button
            onClick={openRequestForSelection}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t('leave.requestLeave', 'Request Leave')}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile icon={CalendarDays} label={t('leave.totalRequests', 'Total Requests')} value={stats.total} color="blue" />
        <StatTile icon={Hourglass} label={t('leave.pending', 'Pending')} value={stats.pending} color="amber" />
        <StatTile icon={CalendarCheck} label={t('leave.approvedDaysYear', 'Approved Days (Year)')} value={stats.approvedDays} color="green" />
        <StatTile icon={Plane} label={t('leave.onLeaveToday', 'On Leave Today')} value={requestsForDay(toKey(new Date())).filter(r => r.status === 'approved').length} color="purple" />
      </div>

      {/* Filters + Legend */}
      <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary} flex flex-wrap items-center gap-4`}>
        <div className="flex items-center gap-2">
          <Filter className={`w-4 h-4 ${text.secondary}`} />
          <span className={`text-sm ${text.secondary}`}>{t('leave.type', 'Type')}:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary} text-sm`}
          >
            <option value="all">{t('leave.allTypes', 'All Types')}</option>
            <option value="vacation">{leaveTypeMeta.vacation.label}</option>
            <option value="sick">{leaveTypeMeta.sick.label}</option>
            <option value="personal">{leaveTypeMeta.personal.label}</option>
          </select>
        </div>
        {isAdmin && scope === 'all' && (
          <div className="flex items-center gap-2">
            <span className={`text-sm ${text.secondary}`}>{t('leave.employee', 'Employee')}:</span>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary} text-sm`}
            >
              <option value="all">{t('leave.allEmployees', 'All Employees')}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{getDemoEmployeeName(emp, t)}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {['vacation', 'sick', 'personal'].map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${metaFor(type).dot}`} />
              <span className={`text-xs ${text.secondary}`}>{metaFor(type).label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className={`${bg.secondary} rounded-xl border ${border.primary} overflow-hidden`}>
        {/* Calendar header */}
        <div className={`flex items-center justify-between p-4 border-b ${border.primary}`}>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className={`p-2 rounded-lg ${hover.bg} cursor-pointer`} aria-label="Previous month">
              <ChevronLeft className={`w-5 h-5 ${text.primary}`} />
            </button>
            <h3 className={`text-lg font-semibold ${text.primary} w-48 text-center`}>
              {t(`months.${MONTHS[currentMonth.getMonth()].toLowerCase()}`, MONTHS[currentMonth.getMonth()])} {currentMonth.getFullYear()}
            </h3>
            <button onClick={nextMonth} className={`p-2 rounded-lg ${hover.bg} cursor-pointer`} aria-label="Next month">
              <ChevronRight className={`w-5 h-5 ${text.primary}`} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {(selStart || selEnd) && (
              <button
                onClick={() => { setSelStart(null); setSelEnd(null); }}
                className={`px-3 py-1.5 text-sm rounded-lg ${hover.bg} ${text.secondary} cursor-pointer flex items-center gap-1`}
              >
                <X className="w-4 h-4" /> {t('leave.clearSelection', 'Clear selection')}
              </button>
            )}
            <button onClick={goToToday} className={`px-3 py-1.5 text-sm rounded-lg border ${border.primary} ${text.primary} ${hover.bg} cursor-pointer`}>
              {t('leave.today', 'Today')}
            </button>
          </div>
        </div>

        {/* Selection hint */}
        <div className={`px-4 py-2 text-xs ${text.secondary} ${bg.tertiary} border-b ${border.primary}`}>
          {selStart && selEnd
            ? t('leave.selectionRange', 'Selected') + `: ${selStart} → ${selEnd}`
            : selStart
              ? t('leave.selectEndHint', 'Now click the end date (or the same day for a single day).')
              : t('leave.selectStartHint', 'Tip: click a day to start a leave request, then click the end day.')}
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map(d => (
            <div key={d} className={`px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide ${text.secondary} border-b ${border.primary}`}>
              {t(`weekdaysShort.${d.toLowerCase()}`, d)}
            </div>
          ))}
        </div>

        {/* Days grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {weeks.flat().map((cell, idx) => {
              const dayRequests = requestsForDay(cell.key);
              const selected = inSelection(cell.key);
              return (
                <button
                  type="button"
                  key={cell.key + idx}
                  onClick={() => handleDayClick(cell.key)}
                  className={`relative text-left min-h-[96px] md:min-h-[120px] p-2 border-b border-r ${border.primary} transition-colors cursor-pointer
                    ${cell.inMonth ? '' : isDarkMode ? 'bg-gray-900/40' : 'bg-gray-50/70'}
                    ${cell.isWeekend && cell.inMonth ? (isDarkMode ? 'bg-gray-800/60' : 'bg-gray-50') : ''}
                    ${selected ? (isDarkMode ? 'ring-2 ring-blue-500 ring-inset bg-blue-900/20' : 'ring-2 ring-blue-500 ring-inset bg-blue-50') : hover.bg}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm
                      ${cell.isToday ? 'bg-blue-600 text-white font-bold' : cell.inMonth ? text.primary : text.tertiary}`}>
                      {cell.day}
                    </span>
                    {dayRequests.length > 2 && (
                      <span className={`text-[10px] ${text.secondary}`}>+{dayRequests.length - 2}</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayRequests.slice(0, 2).map(req => {
                      const meta = metaFor(req.leave_type);
                      return (
                        <div
                          key={req.id}
                          className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate ${meta.chip} ${req.status === 'rejected' ? 'opacity-50 line-through' : ''} ${req.status === 'pending' ? 'border-dashed' : ''}`}
                          title={`${employeeName(req)} • ${meta.label} • ${t(`status.${req.status}`, req.status)}`}
                        >
                          {isAdmin && scope === 'all' ? `${employeeName(req).split(' ')[0]} · ${meta.label}` : meta.label}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Requests list */}
      <div className={`${bg.secondary} rounded-xl border ${border.primary} overflow-hidden`}>
        <div className={`p-4 border-b ${border.primary} flex items-center gap-2`}>
          <CalendarClock className={`w-5 h-5 ${text.secondary}`} />
          <h3 className={`text-lg font-semibold ${text.primary}`}>{t('leave.requestsTitle', 'Leave Requests')}</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {visibleRequests.length === 0 ? (
            <div className={`p-8 text-center ${text.secondary}`}>{t('leave.noRequests', 'No leave requests yet.')}</div>
          ) : (
            [...visibleRequests]
              .sort((a, b) => normalize(b.start_date).localeCompare(normalize(a.start_date)))
              .map(req => {
                const meta = metaFor(req.leave_type);
                const Icon = meta.Icon;
                const canModerate = isAdmin && req.status === 'pending';
                return (
                  <div key={req.id} className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${hover.bg} transition-colors`}>
                    <div className={`p-2 rounded-lg ${meta.chip} border shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(isAdmin && scope === 'all') && (
                          <span className={`font-semibold ${text.primary}`}>{employeeName(req)}</span>
                        )}
                        <span className={`text-sm ${text.secondary}`}>{meta.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(req.status)}`}>
                          {t(`status.${req.status}`, req.status)}
                        </span>
                      </div>
                      <div className={`text-sm ${text.secondary} mt-0.5 flex items-center gap-2 flex-wrap`}>
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>{normalize(req.start_date)} → {normalize(req.end_date || req.start_date)}</span>
                        {req.days_count != null && (
                          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{req.days_count} {t('leave.days', 'days')}</span>
                        )}
                      </div>
                      {req.reason && <p className={`text-sm ${text.tertiary} mt-1 truncate`}>{req.reason}</p>}
                    </div>
                    {canModerate && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(req)}
                          className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-4 h-4" /> {t('leave.approve', 'Approve')}
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" /> {t('leave.reject', 'Reject')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <LeaveRequestModal
          employees={employees}
          canViewAll={canViewAll}
          myEmployeeId={myEmployeeId}
          initialStart={selStart}
          initialEnd={selEnd || selStart}
          leaveTypeMeta={leaveTypeMeta}
          onClose={() => setShowRequestModal(false)}
          onSuccess={(message) => {
            setShowRequestModal(false);
            setSelStart(null);
            setSelEnd(null);
            flash(setSuccessMessage, message);
            fetchData({ silent: true });
          }}
          onError={(message) => flash(setErrorMessage, message)}
        />
      )}
    </div>
  );
};

// ---- Stat tile ----
const StatTile = ({ icon, label, value, color }) => {
  const Icon = icon;
  const { bg, text, border, isDarkMode } = useTheme();
  const colorMap = {
    blue: isDarkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700',
    amber: isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700',
    green: isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700',
    purple: isDarkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700',
  };
  return (
    <div className={`${bg.secondary} rounded-xl p-4 border ${border.primary} flex items-center gap-3`}>
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className={`text-xs ${text.secondary}`}>{label}</p>
        <p className={`text-xl font-bold ${text.primary}`}>{value}</p>
      </div>
    </div>
  );
};

// ---- Request modal ----
const LeaveRequestModal = ({ employees, canViewAll, myEmployeeId, initialStart, initialEnd, leaveTypeMeta, onClose, onSuccess, onError }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { handleSessionAuthError } = useSessionGuard();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    employeeId: myEmployeeId || (employees[0]?.id ? String(employees[0].id) : ''),
    type: 'vacation',
    startDate: initialStart || '',
    endDate: initialEnd || initialStart || '',
    halfDay: false,
    startTime: '09:00',
    endTime: '17:00',
    reason: '',
  });

  const dayCount = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = fromKey(form.startDate);
    const end = fromKey(form.endDate);
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (diff <= 0) return 0;
    if (form.halfDay && form.startDate === form.endDate) return 0.5;
    return diff;
  }, [form.startDate, form.endDate, form.halfDay]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const buildReason = () => {
    const tags = [];
    if (form.halfDay) tags.push(t('leave.halfDayTag', '[Half day]'));
    if (!form.halfDay && (form.startTime !== '09:00' || form.endTime !== '17:00')) {
      tags.push(`[${form.startTime}-${form.endTime}]`);
    }
    return `${tags.join(' ')}${tags.length ? ' ' : ''}${form.reason}`.trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      onError(t('leave.selectDatesFirst', 'Click a start and end date on the calendar first.'));
      return;
    }
    if (form.endDate < form.startDate) {
      onError(t('leave.invalidRange', 'End date cannot be before start date.'));
      return;
    }
    if (!form.employeeId) {
      onError(t('leave.selectEmployee', 'Please select an employee.'));
      return;
    }
    setLoading(true);
    try {
      const result = await timeTrackingService.createLeaveRequest({
        employeeId: form.employeeId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: buildReason(),
      });
      if (result.success) {
        onSuccess(t('leave.requestSubmitted', 'Leave request submitted successfully!'));
      } else {
        onError(result.error || t('errors.saveFailed', 'Failed to submit request'));
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      if (handleSessionAuthError(error)) { setLoading(false); return; }
      onError(t('errors.saveFailed', 'Failed to submit request'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${bg.secondary} rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center p-6 border-b ${border.primary}`}>
          <h2 className={`text-xl font-semibold ${text.primary} flex items-center gap-2`}>
            <CalendarDays className="w-5 h-5" />
            {t('leave.requestLeave', 'Request Leave')}
          </h2>
          <button onClick={onClose} className={`${text.secondary} hover:${text.primary} cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {canViewAll && (
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('leave.employee', 'Employee')}</label>
              <select
                value={form.employeeId}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary}`}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{getDemoEmployeeName(emp, t)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('timeTracking.leaveType', 'Leave Type')}</label>
            <div className="grid grid-cols-3 gap-2">
              {['vacation', 'sick', 'personal'].map(type => {
                const meta = leaveTypeMeta[type];
                const Icon = meta.Icon;
                const active = form.type === type;
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => handleChange('type', type)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border transition-colors cursor-pointer ${active ? 'border-blue-500 ' + (isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50') : border.primary}`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-blue-500' : text.secondary}`} />
                    <span className={`text-xs ${active ? text.primary : text.secondary}`}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected dates (chosen from the custom calendar) */}
          <div className={`rounded-lg border ${border.primary} ${bg.tertiary} p-3`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${text.secondary}`}>{t('leave.selectedDates', 'Selected Dates')}</p>
                <p className={`text-sm font-medium ${text.primary}`}>
                  {form.startDate || '—'} {form.endDate && form.endDate !== form.startDate ? `→ ${form.endDate}` : ''}
                </p>
              </div>
              <span className={`text-sm font-semibold ${text.primary}`}>{dayCount} {t('leave.days', 'days')}</span>
            </div>
            <p className={`text-[11px] ${text.tertiary} mt-1`}>{t('leave.adjustOnCalendar', 'Close this dialog to re-pick dates on the calendar.')}</p>
          </div>

          {/* Detailed time */}
          <div className="flex items-center gap-2">
            <input
              id="halfDay"
              type="checkbox"
              checked={form.halfDay}
              onChange={(e) => handleChange('halfDay', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="halfDay" className={`text-sm ${text.primary} cursor-pointer`}>{t('leave.halfDay', 'Half day')}</label>
          </div>

          {!form.halfDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-1 flex items-center gap-1`}>
                  <Clock className="w-3.5 h-3.5" />{t('leave.startTime', 'Start Time')}
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => handleChange('startTime', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-1 flex items-center gap-1`}>
                  <Clock className="w-3.5 h-3.5" />{t('leave.endTime', 'End Time')}
                </label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => handleChange('endTime', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary}`}
                />
              </div>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('leave.reason', 'Reason')}</label>
            <textarea
              value={form.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              rows={3}
              placeholder={t('leave.reasonPlaceholder', 'Add an optional note for your manager...')}
              className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary} resize-none`}
            />
          </div>

          <div className={`flex justify-end gap-3 pt-2 border-t ${border.primary}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} rounded-lg cursor-pointer`}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || dayCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common.saving', 'Saving...') : t('leave.submitRequest', 'Submit Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveManagement;
