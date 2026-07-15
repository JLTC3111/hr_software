import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Palmtree,
  UserMinus,
  Stethoscope,
  User,
  Loader,
  CheckCircle,
  AlertCircle,
  Filter,
  MousePointerClick,
  ArrowRight,
  Sparkles,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as timeTrackingService from '../services/timeTrackingService';
import { isDemoMode, getDemoEmployeeName, updateDemoLeaveRequest } from '../utils/demoHelper';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { SlidingNumber } from './motion-primitives';
import { PageLiveClock } from './ui/page-live-clock';
import { filterActiveEmployees } from '../utils/employeeStatus.js';

/* @refresh reset */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Local-safe date key (avoids UTC off-by-one)
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const normalize = (value) => (value || '').toString().slice(0, 10);

const LeaveManagement = ({ employees = [], allEmployees }) => {
  const { bg, text, border, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user, checkPermission, isAuthenticated } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();

  const canViewAll = checkPermission('canViewReports');
  const canManageLeave = canViewAll || checkPermission('canManageTimeTracking');
  const myEmployeeId = String(user?.employeeId || user?.id || '');

  // Assign/create pickers and filters: active only
  const pickerEmployees = filterActiveEmployees(employees);
  // Name resolution for historical rows may still need inactive people
  const employeeDirectory = allEmployees?.length ? allEmployees : employees;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const leaveCacheRef = useRef({ key: '', data: [] });
  const fetchRequestRef = useRef(0);
  const fetchYear = currentMonth.getFullYear();
  const [scope, setScope] = useState(canManageLeave ? 'all' : 'mine'); // 'all' | 'mine'
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestModalMode, setRequestModalMode] = useState('calendar'); // 'calendar' | 'admin'
  const [rejectTarget, setRejectTarget] = useState(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const flash = useCallback((setter, message) => {
    setter(message);
    setTimeout(() => setter(''), 3500);
  }, []);

  const fetchData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!isAuthenticated && !isDemoMode()) return;
    if (!myEmployeeId && !canManageLeave && !isDemoMode()) return;

    const cacheKey = `${scope}-${fetchYear}-${canManageLeave && scope === 'all' ? 'all' : myEmployeeId}`;
    if (leaveCacheRef.current.key === cacheKey) {
      setLeaveRequests(leaveCacheRef.current.data);
      return;
    }

    const requestId = ++fetchRequestRef.current;
    if (!silent) setLoading(true);
    try {
      const filters = { year: fetchYear };
      let result;
      if (canManageLeave && scope === 'all') {
        result = await timeTrackingService.getAllLeaveRequests({
          ...filters,
          includeEmployeeDetails: false,
        });
      } else {
        result = await timeTrackingService.getLeaveRequests(myEmployeeId, filters);
      }
      if (requestId !== fetchRequestRef.current) return;
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [];
        leaveCacheRef.current = { key: cacheKey, data };
        setLeaveRequests(data);
      }
    } catch (error) {
      if (requestId !== fetchRequestRef.current) return;
      console.error('Error fetching leave requests:', error);
      handleSessionAuthError(error, { silent });
    } finally {
      if (requestId === fetchRequestRef.current && !silent) setLoading(false);
    }
  }, [canManageLeave, scope, myEmployeeId, handleSessionAuthError, isAuthenticated, fetchYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAuthenticatedPageRefresh(() => {
    leaveCacheRef.current = { key: '', data: [] };
    fetchData({ silent: true });
  });

  // ---- Leave type styling ----
  const leaveTypeMeta = useMemo(() => ({
    vacation: { label: t('timeTracking.vacation', 'Vacation'), Icon: Palmtree, dot: 'bg-blue-500', chip: isDarkMode ? 'bg-blue-900/50 text-blue-200 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300' },
    sick: { label: t('timeTracking.sickLeave', 'Sick Leave'), Icon: Stethoscope, dot: 'bg-rose-500', chip: isDarkMode ? 'bg-rose-900/50 text-rose-200 border-rose-700' : 'bg-rose-100 text-rose-800 border-rose-300' },
    personal: { label: t('timeTracking.personal', 'Personal Leave'), Icon: User, dot: 'bg-purple-500', chip: isDarkMode ? 'bg-purple-900/50 text-purple-200 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-300' },
    other: { label: t('leave.other', 'Other'), Icon: CalendarDays, dot: 'bg-gray-500', chip: isDarkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-300' },
  }), [t, isDarkMode]);

  const metaFor = useCallback((type) => leaveTypeMeta[type] || leaveTypeMeta.other, [leaveTypeMeta]);

  const employeeName = useCallback((req) => {
    if (req.employee?.name) return getDemoEmployeeName(req.employee, t);
    const emp = employeeDirectory.find(e => String(e.id) === String(req.employee_id));
    return emp ? getDemoEmployeeName(emp, t) : t('taskReview.unknown', 'Unknown');
  }, [employeeDirectory, t]);

  // ---- Filtered requests ----
  const visibleRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      if (typeFilter !== 'all' && req.leave_type !== typeFilter) return false;
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (canManageLeave && scope === 'all' && employeeFilter !== 'all' && String(req.employee_id) !== String(employeeFilter)) return false;
      return true;
    });
  }, [leaveRequests, typeFilter, statusFilter, employeeFilter, canManageLeave, scope]);

  const requestsForDay = useCallback((key) => {
    return visibleRequests.filter(req => {
      const s = normalize(req.start_date);
      const e = normalize(req.end_date || req.start_date);
      return key >= s && key <= e;
    });
  }, [visibleRequests]);

  const leaveByDay = useMemo(() => {
    const map = new Map();
    visibleRequests.forEach((req) => {
      const start = fromKey(normalize(req.start_date));
      const end = fromKey(normalize(req.end_date || req.start_date));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = toKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(req);
      }
    });
    return map;
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

  const selectionComplete = Boolean(selStart && selEnd);
  const selectionPhase = !selStart ? 'pickStart' : !selEnd ? 'pickEnd' : 'ready';

  const selectionDayCount = useMemo(() => {
    if (!selStart) return 0;
    const end = selEnd || selStart;
    const start = fromKey(selStart);
    const finish = fromKey(end);
    return Math.max(1, Math.round((finish - start) / (1000 * 60 * 60 * 24)) + 1);
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
    setRequestModalMode('calendar');
    setShowRequestModal(true);
  };

  const openAdminRequest = () => {
    setRequestModalMode('admin');
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
  const refreshAfterMutation = () => {
    leaveCacheRef.current = { key: '', data: [] };
    fetchData({ silent: true });
  };

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

  const handleReject = async (req, reason = '') => {
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

  const confirmReject = async (reason) => {
    if (!rejectTarget) return;
    await handleReject(rejectTarget, reason);
    setRejectTarget(null);
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'approved': return isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800';
      case 'rejected': return isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-800';
      default: return isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-800';
    }
  };

  const isAdmin = canManageLeave;
  const defaultModalEmployee = employeeFilter !== 'all' ? String(employeeFilter) : (myEmployeeId || (pickerEmployees[0]?.id != null ? String(pickerEmployees[0].id) : ''));
  const borderPrimary = border.primary;

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
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className={`text-2xl font-bold ${text.primary}`}>{t('nav.leaveManagement', 'Leave Management')}</h2>
            <PageLiveClock
              textClassName={text.primary}
              separatorClassName={text.secondary}
              loading={loading}
              isDarkMode={isDarkMode}
              fetchLabel={t('common.fetching', 'Fetching')}
            />
          </div>
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
          {isAdmin && (
            <button
              onClick={openAdminRequest}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer border ${border.primary}
                ${isDarkMode ? 'bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50 border-emerald-700' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300'}`}
            >
              <UserPlus className="h-4 w-4" />
              <span>{t('leave.addForEmployee', 'Add for Employee')}</span>
            </button>
          )}
          <button
            onClick={openRequestForSelection}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer
              ${selectionComplete
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent scale-[1.02] animate-pulse'
                : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            title={selectionComplete
              ? t('leave.rangeReady', 'Dates selected — click to request leave')
              : t('leave.selectDatesFirst', 'Click a start and end date on the calendar first.')}
          >
            <Plus className="h-4 w-4" />
            <span>{t('leave.requestLeave', 'Request Leave')}</span>
            {selectionComplete && (
              <span className="hidden sm:inline text-xs opacity-90 ml-1">
                ({selectionDayCount} {t('leave.days', 'days')})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile IconComponent={CalendarDays} label={t('leave.totalRequests', 'Total Requests')} value={stats.total} colorKey="blue" />
        <StatTile IconComponent={Hourglass} label={t('leave.pending', 'Pending')} value={stats.pending} colorKey="amber" />
        <StatTile IconComponent={CalendarCheck} label={t('leave.approvedDaysYear', 'Approved Days (Year)')} value={stats.approvedDays} colorKey="green" />
        <StatTile IconComponent={UserMinus} label={t('leave.onLeaveToday', 'On Leave Today')} value={requestsForDay(toKey(new Date())).filter(r => r.status === 'approved').length} colorKey="purple" />
      </div>

      {/* Calendar */}
      <div className={`${bg.secondary} rounded-xl border ${border.primary} overflow-hidden shadow-lg ${isDarkMode ? 'shadow-black/20 ring-1 ring-white/5' : 'shadow-blue-500/10 ring-1 ring-blue-500/10'}`}>
        {/* Calendar header */}
        <div className={`flex items-center justify-between p-4 border-b ${border.primary} ${isDarkMode ? 'bg-gradient-to-r from-blue-950/60 to-indigo-950/40' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
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

        {/* Selection guide — step indicator */}
        <div className={`px-4 py-3 border-b ${border.primary} ${isDarkMode ? 'bg-gray-800/50' : 'bg-blue-50/60'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              {[1, 2].map((step) => {
                const active = (step === 1 && selectionPhase === 'pickStart')
                  || (step === 2 && selectionPhase === 'pickEnd');
                const done = (step === 1 && selectionPhase !== 'pickStart')
                  || (step === 2 && selectionPhase === 'ready');
                return (
                  <React.Fragment key={step}>
                    {step === 2 && <ArrowRight className={`w-4 h-4 shrink-0 ${text.tertiary}`} />}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                      ${done ? (isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800')
                        : active ? (isDarkMode ? 'bg-blue-900/50 text-blue-200 ring-1 ring-blue-500' : 'bg-blue-100 text-blue-800 ring-1 ring-blue-400')
                          : `${bg.tertiary} ${text.tertiary}`}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                        ${done ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        {done ? '✓' : step}
                      </span>
                      <span>
                        {step === 1
                          ? t('leave.stepPickStart', 'Click your first day')
                          : t('leave.stepPickEnd', 'Click your last day')}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <p className={`text-xs sm:text-sm ${selectionPhase === 'ready' ? (isDarkMode ? 'text-green-300' : 'text-green-700') : text.secondary}`}>
              {selectionPhase === 'ready' && (
                <span className="inline-flex items-center gap-1 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('leave.selectionRange', 'Selected')}: {selStart} → {selEnd}
                  <span className={`ml-1 ${text.tertiary}`}>({selectionDayCount} {t('leave.days', 'days')})</span>
                </span>
              )}
              {selectionPhase === 'pickEnd' && (
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="w-3.5 h-3.5" />
                  {t('leave.selectEndHint', 'Now click the end date (or the same day for a single day).')}
                </span>
              )}
              {selectionPhase === 'pickStart' && (
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="w-3.5 h-3.5" />
                  {t('leave.selectStartHint', 'Tip: click a day to start a leave request, then click the end day.')}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Weekday header — full-width band with weekend emphasis */}
        <div className={`grid grid-cols-7 border-b ${border.primary} ${isDarkMode ? 'bg-gray-900/80' : 'bg-gray-100'}`}>
          {WEEKDAYS.map((d, i) => {
            const isWeekend = i === 0 || i === 6;
            return (
              <div
                key={d}
                className={`px-1 py-3 text-center border-r last:border-r-0 ${border.primary}
                  ${isWeekend ? (isDarkMode ? 'bg-gray-800/90' : 'bg-gray-200/80') : ''}`}
              >
                <span className={`block text-[10px] sm:text-xs font-bold uppercase tracking-widest
                  ${isWeekend ? (isDarkMode ? 'text-rose-300' : 'text-rose-600') : text.primary}`}>
                  {t(`weekdaysShort.${d.toLowerCase()}`, d)}
                </span>
                <span className={`hidden md:block text-[10px] mt-0.5 ${isWeekend ? (isDarkMode ? 'text-rose-400/70' : 'text-rose-500/80') : text.tertiary}`}>
                  {t(`weekdays.${d.toLowerCase()}`, WEEKDAY_FULL[i])}
                </span>
              </div>
            );
          })}
        </div>

        {/* Days grid — always render shell; overlay spinner only while fetching */}
        <div className="relative">
          {loading && (
            <div className={`absolute inset-0 z-10 flex items-center justify-center ${isDarkMode ? 'bg-gray-900/50' : 'bg-white/60'} backdrop-blur-[1px]`}>
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          <div className="grid grid-cols-7">
            {weeks.flat().map((cell, idx) => {
              const dayRequests = leaveByDay.get(cell.key) || [];
              const selected = inSelection(cell.key);
              const isRangeStart = selStart === cell.key;
              const isRangeEnd = selEnd === cell.key;
              const isInRange = selected && Boolean(selEnd);
              const isRangeMiddle = isInRange && !isRangeStart && !isRangeEnd;
              const awaitingEnd = selectionPhase === 'pickEnd' && isRangeStart;

              const cellSurface = (() => {
                if (isInRange || (selected && !selEnd)) {
                  if (isDarkMode) {
                    if (isRangeStart || isRangeEnd) return 'bg-blue-700/45 ring-2 ring-inset ring-blue-400';
                    if (isRangeMiddle) return 'bg-blue-800/35';
                    return 'bg-blue-900/40 ring-2 ring-inset ring-blue-500';
                  }
                  if (isRangeStart || isRangeEnd) return 'bg-blue-300 ring-2 ring-inset ring-blue-600';
                  if (isRangeMiddle) return 'bg-blue-200/90';
                  return 'bg-blue-200 ring-2 ring-inset ring-blue-500';
                }
                if (!cell.inMonth) return isDarkMode ? 'bg-gray-900/40' : 'bg-gray-50/70';
                if (cell.isWeekend) return isDarkMode ? 'bg-gray-800/60' : 'bg-gray-50';
                return '';
              })();

              return (
                <button
                  type="button"
                  key={cell.key + idx}
                  onClick={() => handleDayClick(cell.key)}
                  title={cell.inMonth && selectionPhase !== 'ready'
                    ? t('leave.clickToSelect', 'Click to select this day')
                    : undefined}
                  className={`relative text-left min-h-[96px] md:min-h-[120px] p-2 border-b border-r ${border.primary} transition-all cursor-pointer group
                    ${cellSurface}
                    ${!selected && cell.inMonth ? hover.bg : ''}
                    ${awaitingEnd ? 'animate-pulse' : ''}
                  `}
                >
                  {isInRange && (
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-x-0 top-0 h-1
                        ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'}
                        ${isRangeStart ? 'left-1 rounded-l-full' : ''}
                        ${isRangeEnd ? 'right-1 rounded-r-full' : ''}`}
                    />
                  )}
                  <div className="flex items-center justify-between gap-1 relative z-[1]">
                    <span className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1 rounded-full text-sm
                      ${cell.isToday ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : isInRange ? (isDarkMode ? 'bg-blue-600 text-white font-semibold' : 'bg-blue-600 text-white font-semibold')
                          : selected && !selEnd ? 'bg-blue-600 text-white font-semibold'
                            : cell.inMonth ? text.primary : text.tertiary}`}>
                      {cell.day}
                    </span>
                    <div className="flex items-center gap-1">
                      {isRangeStart && (
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${isDarkMode ? 'bg-blue-700 text-blue-100' : 'bg-blue-600 text-white'}`}>
                          {t('leave.rangeStart', 'Start')}
                        </span>
                      )}
                      {isRangeEnd && selEnd && (
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${isDarkMode ? 'bg-blue-700 text-blue-100' : 'bg-blue-600 text-white'}`}>
                          {t('leave.rangeEnd', 'End')}
                        </span>
                      )}
                      {dayRequests.length > 2 && (
                        <span className={`text-[10px] ${text.secondary}`}>+{dayRequests.length - 2}</span>
                      )}
                    </div>
                  </div>
                  {cell.inMonth && selectionPhase === 'pickStart' && dayRequests.length === 0 && (
                    <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap ${text.tertiary}`}>
                      {t('leave.clickToSelect', 'Click to select')}
                    </span>
                  )}
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
        </div>

        {/* In-calendar CTA once a date range is selected */}
        {selectionComplete && (
          <div className={`p-4 border-t ${border.primary} ${isDarkMode ? 'bg-gradient-to-r from-blue-900/40 to-indigo-900/40' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${text.primary}`}>
                  {t('leave.rangeReady', 'Dates selected — ready to request leave')}
                </p>
                <p className={`text-xs ${text.secondary} mt-0.5`}>
                  {selStart} → {selEnd} · {selectionDayCount} {t('leave.days', 'days')}
                </p>
              </div>
              <button
                type="button"
                onClick={openRequestForSelection}
                className="shrink-0 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg ring-2 ring-blue-400/60 hover:ring-blue-300 transition-all cursor-pointer animate-pulse hover:animate-none"
              >
                <Plus className="w-5 h-5" />
                {t('leave.requestLeaveNow', 'Request Leave Now')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters + Legend — below calendar */}
      <div className={`${bg.secondary} rounded-xl border ${border.primary} overflow-hidden shadow-sm`}>
        <div className={`px-5 py-3.5 border-b ${border.primary} flex items-center gap-2 ${isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50/80'}`}>
          <Filter className={`w-4 h-4 ${text.secondary}`} />
          <h3 className={`text-sm font-semibold ${text.primary}`}>{t('leave.filtersTitle', 'Filters & Legend')}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 space-y-3">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${text.tertiary} mb-2`}>{t('leave.statusFilter', 'Status')}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: t('leave.allStatuses', 'All') },
                    { value: 'pending', label: t('leave.pending', 'Pending') },
                    { value: 'approved', label: t('status.approved', 'Approved') },
                    { value: 'rejected', label: t('status.rejected', 'Rejected') },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border
                        ${statusFilter === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : `${border.primary} ${bg.tertiary} ${text.secondary} hover:border-blue-400/60`}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${text.tertiary} mb-2`}>{t('leave.type', 'Type')}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: t('leave.allTypes', 'All Types') },
                    { value: 'vacation', label: leaveTypeMeta.vacation.label },
                    { value: 'sick', label: leaveTypeMeta.sick.label },
                    { value: 'personal', label: leaveTypeMeta.personal.label },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTypeFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5
                        ${typeFilter === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : `${border.primary} ${bg.tertiary} ${text.secondary} hover:border-blue-400/60`}`}
                    >
                      {opt.value !== 'all' && <span className={`w-2 h-2 rounded-full ${metaFor(opt.value).dot}`} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {isAdmin && scope === 'all' && (
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wide ${text.tertiary} mb-2`}>{t('leave.employee', 'Employee')}</p>
                  <select
                    value={employeeFilter || 'all'}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className={`w-full sm:w-auto min-w-[200px] px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary} text-sm`}
                  >
                    <option value="all">{t('leave.allEmployees', 'All Employees')}</option>
                    {pickerEmployees.map(emp => (
                      <option key={emp.id} value={String(emp.id)}>{getDemoEmployeeName(emp, t)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className={`lg:w-56 shrink-0 rounded-lg border ${border.primary} p-3 ${isDarkMode ? 'bg-gray-900/30' : 'bg-white/60'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${text.tertiary} mb-2`}>{t('leave.legendTitle', 'Legend')}</p>
              <div className="space-y-2">
                {['vacation', 'sick', 'personal'].map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${metaFor(type).dot}`} />
                    <span className={`text-xs ${text.secondary}`}>{metaFor(type).label}</span>
                  </div>
                ))}
                <div className={`pt-2 mt-2 border-t ${border.primary} space-y-1.5`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-3 rounded border border-dashed ${isDarkMode ? 'border-amber-500/60' : 'border-amber-500'}`} />
                    <span className={`text-xs ${text.secondary}`}>{t('leave.pending', 'Pending')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-3 rounded ${isDarkMode ? 'bg-green-900/50 border border-green-700' : 'bg-green-100 border border-green-300'}`} />
                    <span className={`text-xs ${text.secondary}`}>{t('status.approved', 'Approved')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                const canModerate = isAdmin && scope === 'all' && req.status === 'pending';
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
                          onClick={() => setRejectTarget(req)}
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
          t={t}
          employees={pickerEmployees}
          canManageLeave={canManageLeave}
          mode={requestModalMode}
          defaultEmployeeId={defaultModalEmployee}
          myEmployeeId={myEmployeeId}
          initialStart={selStart}
          initialEnd={selEnd || selStart}
          leaveTypeMeta={leaveTypeMeta}
          borderPrimary={borderPrimary}
          onClose={() => setShowRequestModal(false)}
          onSuccess={(message) => {
            setShowRequestModal(false);
            setSelStart(null);
            setSelEnd(null);
            flash(setSuccessMessage, message);
            leaveCacheRef.current = { key: '', data: [] };
            fetchData({ silent: true });
          }}
          onError={(message) => flash(setErrorMessage, message)}
        />
      )}

      {rejectTarget && (
        <RejectLeaveModal
          t={t}
          employeeName={employeeName(rejectTarget)}
          onClose={() => setRejectTarget(null)}
          onConfirm={confirmReject}
        />
      )}
    </div>
  );
};

// ---- Stat tile ----
const StatTile = ({ IconComponent, label, value, colorKey }) => {
  const Icon = IconComponent;
  const { bg, text, border, isDarkMode } = useTheme();
  const colorMap = {
    blue: isDarkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700',
    amber: isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700',
    green: isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700',
    purple: isDarkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700',
  };
  return (
    <div className={`${bg.secondary} rounded-xl p-4 border ${border.primary} flex items-center gap-3`}>
      <div className={`p-2 rounded-lg ${colorMap[colorKey] || colorMap.blue}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <p className={`text-xs ${text.secondary}`}>{label}</p>
        <p className={`text-xl font-bold ${text.primary}`}>
          <SlidingNumber value={Number(value) || 0} />
        </p>
      </div>
    </div>
  );
};

// ---- Request modal ----
const LeaveRequestModal = ({
  t,
  employees,
  canManageLeave,
  mode,
  defaultEmployeeId,
  myEmployeeId,
  initialStart,
  initialEnd,
  leaveTypeMeta,
  borderPrimary,
  onClose,
  onSuccess,
  onError,
}) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { handleSessionAuthError } = useSessionGuard();
  const [loading, setLoading] = useState(false);
  const isAdminMode = mode === 'admin';
  const allowManualDates = isAdminMode;
  const inactiveBorderClass = borderPrimary || border.primary;

  const [form, setForm] = useState({
    employeeId: defaultEmployeeId || myEmployeeId || (employees[0]?.id ? String(employees[0].id) : ''),
    type: 'vacation',
    startDate: initialStart || '',
    endDate: initialEnd || initialStart || '',
    halfDay: false,
    startTime: '09:00',
    endTime: '17:00',
    reason: '',
    autoApprove: isAdminMode,
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
      if (!result.success) {
        onError(result.error || t('errors.saveFailed', 'Failed to submit request'));
        return;
      }

      if (form.autoApprove && canManageLeave && result.data?.id) {
        if (isDemoMode()) {
          updateDemoLeaveRequest(result.data.id, { status: 'approved', approved_by: myEmployeeId });
        } else {
          const approveResult = await timeTrackingService.updateLeaveRequestStatus(result.data.id, 'approved', myEmployeeId);
          if (!approveResult.success) throw new Error(approveResult.error);
        }
        onSuccess(t('leave.submitAndApproved', 'Leave added and approved.'));
      } else {
        onSuccess(t('leave.requestSubmitted', 'Leave request submitted successfully!'));
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      if (handleSessionAuthError(error)) { setLoading(false); return; }
      onError(t('errors.saveFailed', 'Failed to submit request'));
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = isAdminMode
    ? t('leave.addLeaveForEmployee', 'Add Leave for Employee')
    : t('leave.requestLeave', 'Request Leave');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${bg.secondary} rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center p-6 border-b ${border.primary}`}>
          <h2 className={`text-xl font-semibold ${text.primary} flex items-center gap-2`}>
            {isAdminMode ? <UserPlus className="w-5 h-5" /> : <CalendarDays className="w-5 h-5" />}
            {modalTitle}
          </h2>
          <button onClick={onClose} className={`${text.secondary} hover:${text.primary} cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {canManageLeave && (
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('leave.employee', 'Employee')}</label>
              <select
                value={form.employeeId || ''}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary}`}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={String(emp.id)}>{getDemoEmployeeName(emp, t)}</option>
                ))}
              </select>
              {isAdminMode && (
                <p className={`text-xs ${text.tertiary} mt-1 flex items-center gap-1`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t('leave.onBehalfNote', 'You are submitting leave on behalf of this employee.')}
                </p>
              )}
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
                    className={(() => {
                      const base = 'flex flex-col items-center gap-1 py-3 rounded-lg border transition-colors cursor-pointer';
                      if (active) {
                        return `${base} border-blue-500 ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`;
                      }
                      return `${base} ${inactiveBorderClass}`;
                    })()}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-blue-500' : text.secondary}`} />
                    <span className={`text-xs ${active ? text.primary : text.secondary}`}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {allowManualDates ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('leave.rangeStart', 'Start')}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('leave.rangeEnd', 'End')}</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary}`}
                />
              </div>
              <p className={`col-span-2 text-xs ${text.tertiary}`}>
                {dayCount > 0 ? `${dayCount} ${t('leave.days', 'days')}` : t('leave.manualDates', 'Enter start and end dates.')}
              </p>
            </div>
          ) : (
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
          )}

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

          {canManageLeave && (
            <div className={`flex items-start gap-2 p-3 rounded-lg border ${border.primary} ${isDarkMode ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}>
              <input
                id="autoApprove"
                type="checkbox"
                checked={form.autoApprove}
                onChange={(e) => handleChange('autoApprove', e.target.checked)}
                className="w-4 h-4 rounded mt-0.5"
              />
              <label htmlFor="autoApprove" className={`text-sm ${text.primary} cursor-pointer`}>
                <span className="font-medium flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  {t('leave.autoApprove', 'Approve immediately')}
                </span>
                <span className={`block text-xs ${text.secondary} mt-0.5`}>
                  {t('leave.autoApproveHint', 'Skip the pending queue and mark this request as approved.')}
                </span>
              </label>
            </div>
          )}

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
              className={`px-4 py-2 rounded-lg disabled:opacity-50 cursor-pointer text-white
                ${form.autoApprove && canManageLeave ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading
                ? t('common.saving', 'Saving...')
                : form.autoApprove && canManageLeave
                  ? t('leave.submitAndApprove', 'Submit & Approve')
                  : t('leave.submitRequest', 'Submit Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---- Reject modal ----
const RejectLeaveModal = ({ t, employeeName, onClose, onConfirm }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${bg.secondary} rounded-xl shadow-2xl w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center p-5 border-b ${border.primary}`}>
          <h2 className={`text-lg font-semibold ${text.primary}`}>{t('leave.rejectTitle', 'Reject Leave Request')}</h2>
          <button onClick={onClose} className={`${text.secondary} cursor-pointer`} type="button">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className={`text-sm ${text.secondary}`}>
            {(t('leave.rejectConfirm', 'Reject leave for {{name}}?')).replace('{{name}}', employeeName)}
          </p>
          <div>
            <label className={`block text-sm font-medium ${text.secondary} mb-1`}>{t('leave.rejectReasonLabel', 'Reason (optional)')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('leave.rejectReasonPlaceholder', 'Explain why this request is being rejected...')}
              className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.tertiary} ${text.primary} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg cursor-pointer ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common.saving', 'Saving...') : t('leave.confirmReject', 'Reject Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveManagement;
