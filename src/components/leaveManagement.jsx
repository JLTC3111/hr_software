/**
 * Leave Management — the shared calendar as a drawing sheet.
 *
 * The read, top to bottom:
 *   ticker   — requests, pending, approved days this year, on leave today.
 *              The four figures that used to be stat tiles; they belong on the
 *              strip with every other screen's figures.
 *   head     — what you are looking at, the scope seg, and the two ways in:
 *              file for yourself, or file on behalf of someone.
 *   calendar — one blueprint. Six weeks of hairline cells; a selected range is
 *              an accent wash with a rule along its top edge, never a filled
 *              blue block. Each day carries at most two leave chips.
 *   ledger   — the requests below the calendar, one hairline rule per row, with
 *              approve / reject on the row they belong to.
 *   rail     — the pending figure, the filters, and the same requests counted by
 *              leave type. Every number is derived from `visibleRequests`, so
 *              the rail cannot disagree with the calendar.
 *
 * Leave types are told apart by the accent ramp (rampAt), not by four different
 * hues — and status reads through weight and rule: pending is an outline, an
 * approved day is filled accent, a rejected one is struck through. No red, no
 * green.
 *
 * Design system: "Industry" (src/theme/industry.js).
 */
import _React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  Clock,
  CalendarDays,
  Palmtree,
  Stethoscope,
  User,
  Loader2,
  AlertCircle,
  MousePointerClick,
  ArrowRight,
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
import { DatePicker } from './ui/date-picker.jsx';
import { TimePicker } from './ui/time-picker.jsx';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import { Blueprint, Bar, Tag, Btn, Seg, Kicker, ColumnHeading, TickerCell, LiveClock, FlatSelect } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';

/* @refresh reset */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Order fixes each type's place on the accent ramp, so a colour never moves. */
const LEAVE_TYPES = ['vacation', 'sick', 'personal', 'other'];

/** pending asks for a decision, approved is settled, rejected is closed. */
const STATUS_VARIANT = { pending: 'outline', approved: 'accent', rejected: 'neutral' };

// Local-safe date key (avoids UTC off-by-one)
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const normalize = (value) => (value || '').toString().slice(0, 10);

const LeaveManagement = ({ employees = [], allEmployees }) => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  const { user, checkPermission, isAuthenticated } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();

  const canViewAll = checkPermission('canViewReports');
  const canManageLeave = canViewAll || checkPermission('canManageTimeTracking');
  const myEmployeeId = String(user?.employeeId || user?.id || '');

  // Assign/create pickers and filters: active only.
  // Memoized so the array identity is stable for the child components it is
  // handed to, instead of being rebuilt on every render.
  const pickerEmployees = useMemo(() => filterActiveEmployees(employees), [employees]);
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

  // ---- Leave type identity: label, icon, and a fixed place on the ramp ----
  const leaveTypeMeta = useMemo(() => ({
    vacation: { label: t('timeTracking.vacation', 'Vacation'), Icon: Palmtree, tone: rampAt(ind, 0) },
    sick: { label: t('timeTracking.sickLeave', 'Sick Leave'), Icon: Stethoscope, tone: rampAt(ind, 1) },
    personal: { label: t('timeTracking.personal', 'Personal Leave'), Icon: User, tone: rampAt(ind, 2) },
    other: { label: t('leave.other', 'Other'), Icon: CalendarDays, tone: rampAt(ind, 3) },
  }), [t, ind]);

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

  const onLeaveToday = requestsForDay(toKey(new Date())).filter(r => r.status === 'approved').length;

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

  const isAdmin = canManageLeave;
  const defaultModalEmployee = employeeFilter !== 'all' ? String(employeeFilter) : (myEmployeeId || (pickerEmployees[0]?.id != null ? String(pickerEmployees[0].id) : ''));

  const monthLabel = `${t(`months.${MONTHS[currentMonth.getMonth()].toLowerCase()}`, MONTHS[currentMonth.getMonth()])} ${currentMonth.getFullYear()}`;

  /* ---------------- shared styles ---------------- */

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const columnNote = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '6px 0 0' };
  const fieldLabelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 6,
  };
  const iconBtnStyle = {
    width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${ind.hairline}`, background: 'transparent', color: ind.ink,
    borderRadius: 0, cursor: 'pointer', padding: 0, flex: 'none',
  };
  const chipStyle = (active) => ({
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
    textTransform: 'uppercase', padding: '5px 10px', borderRadius: 0, cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
    background: active ? ind.accent : 'transparent',
    color: active ? ind.accentInk : ind.inkGhost,
    border: `1px solid ${active ? ind.accent : ind.hairline}`,
    transition: 'background .15s ease, color .15s ease',
  });

  const byTypeRows = LEAVE_TYPES
    .map((type) => ({ type, count: stats.byType[type] || 0, meta: metaFor(type) }))
    .filter((row) => row.count > 0);
  const byTypeTotal = byTypeRows.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <div
      data-screen-label="Leave Management"
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER ───────────────────────────────────────────────── */}
      <div
        style={{
          height: 44, background: ind.tickerBg, color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind}>
          <LiveClock ind={ind} live={leaveRequests.length > 0} />
        </TickerCell>
        <TickerCell ind={ind} label={t('leave.totalRequests', 'Total Requests')} value={stats.total} />
        <TickerCell
          ind={ind}
          label={t('leave.pending', 'Pending')}
          value={stats.pending}
          // The one figure on the strip that asks somebody to decide.
          valueColor={stats.pending > 0 ? ind.tickerUp : undefined}
        />
        <TickerCell ind={ind} label={t('leave.approvedDaysYear', 'Approved Days (Year)')} value={stats.approvedDays} />
        <TickerCell ind={ind} label={t('leave.onLeaveToday', 'On Leave Today')} value={onLeaveToday} />
        <TickerCell ind={ind} label={t('leave.month', 'Month')} value={monthLabel} />

        <div
          style={{
            flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 8, padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
          {isAdmin && scope === 'all' ? (
            <FlatSelect
              ind={ind}
              onDark
              value={employeeFilter || 'all'}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              aria-label={t('leave.employee', 'Employee')}
              style={{ maxWidth: 220 }}
            >
              <option value="all" style={{ color: '#1d1f20' }}>{t('leave.allEmployees', 'All Employees')}</option>
              {pickerEmployees.map(emp => (
                <option key={emp.id} value={String(emp.id)} style={{ color: '#1d1f20' }}>
                  {getDemoEmployeeName(emp, t)}
                </option>
              ))}
            </FlatSelect>
          ) : (
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {t('leave.mine', 'My Leave')}
            </span>
          )}
        </div>
      </div>

      {/* ── BANDS ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — calendar and ledger. min-w-0 or the grid wins. ─ */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {successMessage && (
            <div
              className="flex items-center justify-between"
              style={{ border: `1px solid ${ind.hairline}`, background: ind.accentWash, padding: '9px 12px', gap: 10 }}
            >
              <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{successMessage}</span>
              <Check size={14} strokeWidth={1.5} style={{ flex: 'none', color: ind.accentDeep }} />
            </div>
          )}
          {errorMessage && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ ...caption, marginTop: 4 }}>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* ── PAGE HEAD ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('nav.leaveManagement', 'Leave Management')}
              </h1>
              <p style={{ ...caption, marginTop: 6 }}>
                {t('leave.subtitle', 'Plan, request and approve time off on a shared calendar.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
              {isAdmin && (
                <Seg
                  ind={ind}
                  ariaLabel={t('leave.employee', 'Employee')}
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: 'all', label: t('leave.everyone', 'Everyone') },
                    { value: 'mine', label: t('leave.mine', 'My Leave') },
                  ]}
                />
              )}
              {isAdmin && (
                <Btn ind={ind} onClick={openAdminRequest} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={13} strokeWidth={1.5} />
                  {t('leave.addForEmployee', 'Add for Employee')}
                </Btn>
              )}
              {/* The single solid object on this screen. */}
              <Btn
                ind={ind}
                variant="primary"
                onClick={openRequestForSelection}
                title={selectionComplete
                  ? t('leave.rangeReady', 'Dates selected — click to request leave')
                  : t('leave.selectDatesFirst', 'Click a start and end date on the calendar first.')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={13} strokeWidth={1.5} />
                {t('leave.requestLeave', 'Request Leave')}
                {selectionComplete && (
                  <span style={{ opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
                    {`· ${selectionDayCount} ${t('leave.days', 'days')}`}
                  </span>
                )}
              </Btn>
            </div>
          </div>

          {/* ── CALENDAR ──────────────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: 0, overflow: 'hidden' }}>
            {/* Month bar */}
            <div
              className="flex flex-wrap items-center justify-between"
              style={{ gap: 10, padding: '12px 14px', borderBottom: `1px solid ${ind.hairline}` }}
            >
              <div className="flex items-center" style={{ gap: 8 }}>
                <button type="button" onClick={prevMonth} aria-label={t('common.previous', 'Previous')} style={iconBtnStyle}>
                  <ChevronLeft size={14} strokeWidth={1.5} />
                </button>
                <span
                  style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: ind.ink, minWidth: 168, textAlign: 'center',
                  }}
                >
                  {monthLabel}
                </span>
                <button type="button" onClick={nextMonth} aria-label={t('common.next', 'Next')} style={iconBtnStyle}>
                  <ChevronRight size={14} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                {(selStart || selEnd) && (
                  <Btn ind={ind} onClick={() => { setSelStart(null); setSelEnd(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <X size={12} strokeWidth={1.5} />
                    {t('leave.clearSelection', 'Clear selection')}
                  </Btn>
                )}
                <Btn ind={ind} onClick={goToToday}>{t('leave.today', 'Today')}</Btn>
              </div>
            </div>

            {/* Selection guide — two steps, read through weight not colour */}
            <div
              className="flex flex-col sm:flex-row sm:items-center"
              style={{ gap: 12, padding: '10px 14px', borderBottom: `1px solid ${ind.rule}`, background: ind.accentWash }}
            >
              <div className="flex items-center" style={{ gap: 8, flex: 'none' }}>
                {[1, 2].map((step) => {
                  const active = (step === 1 && selectionPhase === 'pickStart')
                    || (step === 2 && selectionPhase === 'pickEnd');
                  const done = (step === 1 && selectionPhase !== 'pickStart')
                    || (step === 2 && selectionPhase === 'ready');
                  return (
                    <_React.Fragment key={step}>
                      {step === 2 && <ArrowRight size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />}
                      <span
                        className="inline-flex items-center"
                        style={{
                          gap: 7, padding: '4px 9px',
                          border: `1px solid ${active || done ? ind.accent : ind.hairline}`,
                          background: done ? ind.accent : 'transparent',
                          color: done ? ind.accentInk : active ? ind.ink : ind.inkFaint,
                        }}
                      >
                        <span
                          style={{
                            width: 15, height: 15, flex: 'none', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${done ? ind.accentInk : active ? ind.accent : ind.hairline}`,
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, lineHeight: 1,
                          }}
                        >
                          {done ? '✓' : step}
                        </span>
                        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                          {step === 1
                            ? t('leave.stepPickStart', 'Click your first day')
                            : t('leave.stepPickEnd', 'Click your last day')}
                        </span>
                      </span>
                    </_React.Fragment>
                  );
                })}
              </div>

              <p className="inline-flex items-center" style={{ ...caption, fontSize: 11.5, gap: 6, minWidth: 0 }}>
                {selectionPhase === 'ready' ? (
                  <>
                    <Check size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.accentDeep }} />
                    {`${t('leave.selectionRange', 'Selected')}: ${selStart} → ${selEnd} · ${selectionDayCount} ${t('leave.days', 'days')}`}
                  </>
                ) : (
                  <>
                    <MousePointerClick size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                    {selectionPhase === 'pickEnd'
                      ? t('leave.selectEndHint', 'Now click the end date (or the same day for a single day).')
                      : t('leave.selectStartHint', 'Tip: click a day to start a leave request, then click the end day.')}
                  </>
                )}
              </p>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${ind.hairline}` }}>
              {WEEKDAYS.map((d, i) => {
                const isWeekend = i === 0 || i === 6;
                return (
                  <div
                    key={d}
                    style={{
                      padding: '7px 4px', textAlign: 'center',
                      borderRight: i === 6 ? 'none' : `1px solid ${ind.rule}`,
                      background: isWeekend ? ind.hover : 'transparent',
                    }}
                  >
                    <span
                      className="block"
                      style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
                        textTransform: 'uppercase', color: isWeekend ? ind.inkFaint : ind.inkMuted,
                      }}
                    >
                      {t(`weekdaysShort.${d.toLowerCase()}`, d)}
                    </span>
                    <span
                      className="hidden md:block"
                      style={{ fontFamily: BODY, fontSize: 10, color: ind.inkFaint, marginTop: 1 }}
                    >
                      {t(`weekdays.${d.toLowerCase()}`, WEEKDAY_FULL[i])}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Days grid — the shell always renders; the fetch overlays it */}
            <div style={{ position: 'relative' }}>
              {loading && (
                <div
                  style={{
                    position: 'absolute', inset: 0, zIndex: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: ind.dark ? 'rgba(21,24,27,.6)' : 'rgba(242,242,243,.65)',
                  }}
                >
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: ind.inkMuted }} />
                </div>
              )}

              <div className="grid grid-cols-7">
                {weeks.flat().map((cell, idx) => {
                  const dayRequests = leaveByDay.get(cell.key) || [];
                  const selected = inSelection(cell.key);
                  const isRangeStart = selStart === cell.key;
                  const isRangeEnd = selEnd === cell.key;
                  const isInRange = selected && Boolean(selEnd);
                  const isEdge = isRangeStart || isRangeEnd || (selected && !selEnd);

                  return (
                    <button
                      type="button"
                      key={cell.key + idx}
                      onClick={() => handleDayClick(cell.key)}
                      title={cell.inMonth && selectionPhase !== 'ready'
                        ? t('leave.clickToSelect', 'Click to select this day')
                        : undefined}
                      className="relative text-left min-h-[96px] md:min-h-[120px] group"
                      style={{
                        padding: 7,
                        borderBottom: `1px solid ${ind.rule}`,
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : `1px solid ${ind.rule}`,
                        borderRadius: 0,
                        borderTop: 'none',
                        borderLeft: 'none',
                        cursor: 'pointer',
                        // Selection is a wash plus an inset rule — never a filled block.
                        background: selected
                          ? ind.accentWash
                          : !cell.inMonth
                            ? 'transparent'
                            : cell.isWeekend ? ind.hover : 'transparent',
                        boxShadow: isEdge ? `inset 0 0 0 1px ${ind.accent}` : undefined,
                        opacity: cell.inMonth ? 1 : 0.45,
                        transition: 'background .15s ease',
                      }}
                    >
                      {isInRange && (
                        <span
                          aria-hidden="true"
                          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: ind.accent }}
                        />
                      )}

                      <div className="flex items-center justify-between" style={{ gap: 4 }}>
                        <span
                          style={{
                            minWidth: 22, height: 20, padding: '0 4px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 13,
                            fontVariantNumeric: 'tabular-nums',
                            // Today is the only filled square in the grid.
                            background: cell.isToday ? ind.accent : 'transparent',
                            color: cell.isToday ? ind.accentInk : cell.inMonth ? ind.ink : ind.inkFaint,
                          }}
                        >
                          {cell.day}
                        </span>

                        <span className="flex items-center" style={{ gap: 4 }}>
                          {(isRangeStart || (isRangeEnd && selEnd)) && (
                            <span
                              style={{
                                fontFamily: DISPLAY, fontWeight: 600, fontSize: 9, letterSpacing: '.12em',
                                textTransform: 'uppercase', color: ind.accentDeep,
                              }}
                            >
                              {isRangeStart ? t('leave.rangeStart', 'Start') : t('leave.rangeEnd', 'End')}
                            </span>
                          )}
                          {dayRequests.length > 2 && (
                            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, color: ind.inkFaint, fontVariantNumeric: 'tabular-nums' }}>
                              {`+${dayRequests.length - 2}`}
                            </span>
                          )}
                        </span>
                      </div>

                      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {dayRequests.slice(0, 2).map(req => {
                          const meta = metaFor(req.leave_type);
                          const rejected = req.status === 'rejected';
                          return (
                            <span
                              key={req.id}
                              className="block truncate"
                              style={{
                                fontFamily: BODY, fontSize: 10, lineHeight: 1.5,
                                padding: '1px 5px',
                                // The type reads off the ramp on the left edge;
                                // a pending request keeps a dashed outline.
                                border: `1px ${req.status === 'pending' ? 'dashed' : 'solid'} ${ind.hairline}`,
                                borderLeftWidth: 3,
                                borderLeftStyle: 'solid',
                                borderLeftColor: meta.tone,
                                color: ind.ink,
                                opacity: rejected ? 0.45 : 1,
                                textDecoration: rejected ? 'line-through' : 'none',
                              }}
                              title={`${employeeName(req)} • ${meta.label} • ${t(`status.${req.status}`, req.status)}`}
                            >
                              {isAdmin && scope === 'all' ? `${employeeName(req).split(' ')[0]} · ${meta.label}` : meta.label}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Once a range is picked, the way out of the calendar */}
            {selectionComplete && (
              <div
                className="flex flex-col sm:flex-row sm:items-center"
                style={{ gap: 12, padding: '12px 14px', borderTop: `1px solid ${ind.hairline}`, background: ind.accentWash }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ColumnHeading ind={ind} style={{ fontSize: 13 }}>
                    {t('leave.rangeReady', 'Dates selected — ready to request leave')}
                  </ColumnHeading>
                  <p style={{ ...caption, fontSize: 11.5, marginTop: 4 }}>
                    {`${selStart} → ${selEnd} · ${selectionDayCount} ${t('leave.days', 'days')}`}
                  </p>
                </div>
                <Btn
                  ind={ind}
                  variant="primary"
                  onClick={openRequestForSelection}
                  style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                >
                  <Plus size={13} strokeWidth={1.5} />
                  {t('leave.requestLeaveNow', 'Request Leave Now')}
                </Btn>
              </div>
            )}
          </Blueprint>

          {/* ── LEDGER ────────────────────────────────────────────── */}
          <Blueprint ind={ind} style={{ padding: 0 }}>
            <div
              className="flex flex-wrap items-baseline justify-between"
              style={{ gap: 10, padding: '13px 16px', borderBottom: `1px solid ${ind.hairline}` }}
            >
              <ColumnHeading ind={ind}>{t('leave.requestsTitle', 'Leave Requests')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
                {`${visibleRequests.length} / ${leaveRequests.length}`}
              </span>
            </div>

            {visibleRequests.length === 0 ? (
              <p style={{ ...caption, padding: '32px 16px', textAlign: 'center' }}>
                {t('leave.noRequests', 'No leave requests yet.')}
              </p>
            ) : (
              [...visibleRequests]
                .sort((a, b) => normalize(b.start_date).localeCompare(normalize(a.start_date)))
                .map((req, index) => {
                  const meta = metaFor(req.leave_type);
                  const Icon = meta.Icon;
                  const canModerate = isAdmin && scope === 'all' && req.status === 'pending';
                  const rejected = req.status === 'rejected';
                  return (
                    <div
                      key={req.id}
                      className="flex flex-col sm:flex-row sm:items-center"
                      style={{
                        gap: 12, padding: '12px 16px',
                        borderTop: index === 0 ? 'none' : `1px solid ${ind.rule}`,
                        opacity: rejected ? 0.6 : 1,
                      }}
                    >
                      <span
                        style={{
                          width: 30, height: 30, flex: 'none', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${ind.hairline}`, borderLeft: `3px solid ${meta.tone}`,
                          color: ind.ink,
                        }}
                      >
                        <Icon size={14} strokeWidth={1.5} />
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                          {isAdmin && scope === 'all' && (
                            <span style={{ fontFamily: BODY, fontSize: 14, color: ind.ink }}>{employeeName(req)}</span>
                          )}
                          <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>{meta.label}</span>
                          <Tag ind={ind} variant={STATUS_VARIANT[req.status] || 'neutral'}>
                            {t(`status.${req.status}`, req.status)}
                          </Tag>
                        </div>

                        <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 4 }}>
                          <span
                            className="inline-flex items-center"
                            style={{
                              gap: 5, fontFamily: DISPLAY, fontWeight: 600, fontSize: 11,
                              letterSpacing: '.06em', color: ind.inkMuted, fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <CalendarDays size={12} strokeWidth={1.5} />
                            {`${normalize(req.start_date)} → ${normalize(req.end_date || req.start_date)}`}
                          </span>
                          {req.days_count != null && (
                            <span
                              className="inline-flex items-center"
                              style={{
                                gap: 5, fontFamily: DISPLAY, fontWeight: 600, fontSize: 11,
                                letterSpacing: '.06em', color: ind.inkMuted, fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              <Clock size={12} strokeWidth={1.5} />
                              {`${req.days_count} ${t('leave.days', 'days')}`}
                            </span>
                          )}
                        </div>

                        {req.reason && (
                          <p className="truncate" style={{ fontFamily: BODY, fontSize: 12, color: ind.inkFaint, margin: '4px 0 0' }}>
                            {req.reason}
                          </p>
                        )}
                      </div>

                      {canModerate && (
                        <div className="flex items-center" style={{ gap: 7, flex: 'none' }}>
                          <Btn ind={ind} variant="primary" onClick={() => handleApprove(req)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Check size={12} strokeWidth={1.5} />
                            {t('leave.approve', 'Approve')}
                          </Btn>
                          <Btn ind={ind} onClick={() => setRejectTarget(req)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderColor: ind.ink }}>
                            <X size={12} strokeWidth={1.5} />
                            {t('leave.reject', 'Reject')}
                          </Btn>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </Blueprint>
        </div>

        {/* ── RIGHT — the decision column, 340px ─────────────────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${ind.hairline}` }}>
            <Kicker ind={ind}>{t('leave.pending', 'Pending')}</Kicker>
            <div className="flex items-baseline" style={{ gap: 8, margin: '4px 0 0' }}>
              {/* The one figure on this screen worth watching move. */}
              <span style={{ ...figure(52, ind.ink), lineHeight: 0.92 }}>
                <SlidingNumber value={Number(stats.pending) || 0} />
              </span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>
                {t('leave.ofNRequests', 'of {n} requests').replace('{n}', String(stats.total))}
              </span>
            </div>
            <p style={columnNote}>
              {stats.pending > 0 && isAdmin
                ? t('leave.pendingNote', 'Approve or reject them on their row in the ledger.')
                : t('leave.nothingPending', 'Nothing is waiting on a decision.')}
            </p>
          </div>

          {/* Filters */}
          <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('leave.filtersTitle', 'Filters & Legend')}</ColumnHeading>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
            <span style={fieldLabelStyle}>{t('leave.statusFilter', 'Status')}</span>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {[
                { value: 'all', label: t('leave.allStatuses', 'All') },
                { value: 'pending', label: t('leave.pending', 'Pending') },
                { value: 'approved', label: t('status.approved', 'Approved') },
                { value: 'rejected', label: t('status.rejected', 'Rejected') },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={statusFilter === opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  style={chipStyle(statusFilter === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
            <span style={fieldLabelStyle}>{t('leave.type', 'Type')}</span>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {[
                { value: 'all', label: t('leave.allTypes', 'All Types') },
                { value: 'vacation', label: leaveTypeMeta.vacation.label },
                { value: 'sick', label: leaveTypeMeta.sick.label },
                { value: 'personal', label: leaveTypeMeta.personal.label },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={typeFilter === opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  style={chipStyle(typeFilter === opt.value)}
                >
                  {opt.value !== 'all' && (
                    <span aria-hidden="true" style={{ width: 7, height: 7, flex: 'none', background: metaFor(opt.value).tone }} />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend, which is also the breakdown — one thing, not two. */}
          <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind} style={{ fontSize: 13 }}>{t('leave.legendTitle', 'Legend')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.inkMuted }}>
                {t('leave.byType', 'By type')}
              </span>
            </div>
          </div>

          {byTypeRows.length === 0 ? (
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                {t('leave.noRequests', 'No leave requests yet.')}
              </p>
            </div>
          ) : byTypeRows.map((row) => (
            <div key={row.type} style={{ padding: '11px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span className="inline-flex items-center" style={{ gap: 7, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, flex: 'none', background: row.meta.tone }} />
                  <span
                    style={{
                      fontFamily: BODY, fontSize: 12.5, color: ind.ink, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {row.meta.label}
                  </span>
                </span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {row.count}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar ind={ind} value={row.count / byTypeTotal} fill={row.meta.tone} height={6} />
              </div>
            </div>
          ))}

          {/* How status is drawn, so the calendar chips need no caption. */}
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="inline-flex items-center" style={{ gap: 8 }}>
              <span aria-hidden="true" style={{ width: 26, height: 12, flex: 'none', border: `1px dashed ${ind.hairline}` }} />
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{t('leave.pending', 'Pending')}</span>
            </span>
            <span className="inline-flex items-center" style={{ gap: 8 }}>
              <span aria-hidden="true" style={{ width: 26, height: 12, flex: 'none', border: `1px solid ${ind.hairline}`, background: ind.accentWash }} />
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{t('status.approved', 'Approved')}</span>
            </span>
            <span className="inline-flex items-center" style={{ gap: 8 }}>
              <span aria-hidden="true" style={{ width: 26, height: 12, flex: 'none', border: `1px solid ${ind.hairline}`, opacity: 0.45 }} />
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, textDecoration: 'line-through' }}>
                {t('status.rejected', 'Rejected')}
              </span>
            </span>
          </div>
        </aside>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showRequestModal && (
        <LeaveRequestModal
          t={t}
          ind={ind}
          employees={pickerEmployees}
          canManageLeave={canManageLeave}
          mode={requestModalMode}
          defaultEmployeeId={defaultModalEmployee}
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
            leaveCacheRef.current = { key: '', data: [] };
            fetchData({ silent: true });
          }}
          onError={(message) => flash(setErrorMessage, message)}
        />
      )}

      {rejectTarget && (
        <RejectLeaveModal
          t={t}
          ind={ind}
          employeeName={employeeName(rejectTarget)}
          onClose={() => setRejectTarget(null)}
          onConfirm={confirmReject}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Modals — Blueprint dialogs, same as every other overlay on the board
 * ------------------------------------------------------------------ */

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,45,61,.72)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};

const LeaveRequestModal = ({
  t,
  ind,
  employees,
  canManageLeave,
  mode,
  defaultEmployeeId,
  myEmployeeId,
  initialStart,
  initialEnd,
  leaveTypeMeta,
  onClose,
  onSuccess,
  onError,
}) => {
  const { handleSessionAuthError } = useSessionGuard();
  const [loading, setLoading] = useState(false);
  const isAdminMode = mode === 'admin';
  const allowManualDates = isAdminMode;

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
        console.error('Failed to submit leave request:', result.error);
        onError(t('errors.saveFailed', 'Failed to submit request'));
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

  const labelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 4,
  };
  const noteStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, margin: '5px 0 0', lineHeight: 1.45 };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Blueprint ind={ind} style={{ background: ind.ground, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="flex items-start justify-between" style={{ gap: 10 }}>
            <span className="inline-flex items-center" style={{ gap: 8, minWidth: 0 }}>
              {isAdminMode
                ? <UserPlus size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                : <CalendarDays size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />}
              <ColumnHeading ind={ind}>{modalTitle}</ColumnHeading>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {canManageLeave && (
            <div>
              <label htmlFor="leave-employee" style={labelStyle}>{t('leave.employee', 'Employee')}</label>
              <FlatSelect
                ind={ind}
                id="leave-employee"
                value={form.employeeId || ''}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                style={{ width: '100%', textTransform: 'none', letterSpacing: '.02em' }}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={String(emp.id)}>{getDemoEmployeeName(emp, t)}</option>
                ))}
              </FlatSelect>
              {isAdminMode && (
                <p className="inline-flex items-center" style={{ ...noteStyle, gap: 5 }}>
                  <ShieldCheck size={12} strokeWidth={1.5} />
                  {t('leave.onBehalfNote', 'You are submitting leave on behalf of this employee.')}
                </p>
              )}
            </div>
          )}

          <div>
            <span style={labelStyle}>{t('timeTracking.leaveType', 'Leave Type')}</span>
            <div className="grid grid-cols-3" style={{ gap: 6 }}>
              {['vacation', 'sick', 'personal'].map(type => {
                const meta = leaveTypeMeta[type];
                const Icon = meta.Icon;
                const active = form.type === type;
                return (
                  <button
                    type="button"
                    key={type}
                    aria-pressed={active}
                    onClick={() => handleChange('type', type)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '10px 6px', borderRadius: 0, cursor: 'pointer',
                      border: `1px solid ${active ? ind.accent : ind.hairline}`,
                      borderTop: `3px solid ${meta.tone}`,
                      background: active ? ind.accentWash : 'transparent',
                      color: ind.ink,
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: active ? ind.accentDeep : ind.inkMuted }} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {allowManualDates ? (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="leave-start" style={labelStyle}>{t('leave.rangeStart', 'Start')}</label>
                <DatePicker
                  flat
                  id="leave-start"
                  value={form.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="leave-end" style={labelStyle}>{t('leave.rangeEnd', 'End')}</label>
                <DatePicker
                  flat
                  id="leave-end"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                />
              </div>
              <p style={{ ...noteStyle, margin: 0 }} className="sm:col-span-2">
                {dayCount > 0 ? `${dayCount} ${t('leave.days', 'days')}` : t('leave.manualDates', 'Enter start and end dates.')}
              </p>
            </div>
          ) : (
            <div style={{ border: `1px solid ${ind.hairline}`, padding: '10px 12px' }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span style={{ minWidth: 0 }}>
                  <Kicker ind={ind}>{t('leave.selectedDates', 'Selected Dates')}</Kicker>
                  <span
                    className="block"
                    style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, color: ind.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {form.startDate || '—'} {form.endDate && form.endDate !== form.startDate ? `→ ${form.endDate}` : ''}
                  </span>
                </span>
                <span style={{ ...figure(20, ind.ink) }}>
                  {dayCount}
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{` ${t('leave.days', 'days')}`}</span>
                </span>
              </div>
              <p style={noteStyle}>{t('leave.adjustOnCalendar', 'Close this dialog to re-pick dates on the calendar.')}</p>
            </div>
          )}

          {/* Square check, never a rounded box. */}
          <button
            type="button"
            onClick={() => handleChange('halfDay', !form.halfDay)}
            aria-pressed={form.halfDay}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, alignSelf: 'flex-start',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.ink,
            }}
          >
            <span
              style={{
                width: 15, height: 15, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${form.halfDay ? ind.accent : ind.hairline}`,
                background: form.halfDay ? ind.accent : 'transparent',
                color: ind.accentInk,
              }}
            >
              {form.halfDay && <Check size={10} strokeWidth={2} />}
            </span>
            <span style={{ fontFamily: BODY, fontSize: 13 }}>{t('leave.halfDay', 'Half day')}</span>
          </button>

          {!form.halfDay && (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="leave-start-time" style={labelStyle}>{t('leave.startTime', 'Start Time')}</label>
                <TimePicker
                  flat
                  id="leave-start-time"
                  value={form.startTime}
                  onChange={(e) => handleChange('startTime', e.target.value)}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="leave-end-time" style={labelStyle}>{t('leave.endTime', 'End Time')}</label>
                <TimePicker
                  flat
                  id="leave-end-time"
                  value={form.endTime}
                  onChange={(e) => handleChange('endTime', e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="leave-reason" style={labelStyle}>{t('leave.reason', 'Reason')}</label>
            <textarea
              id="leave-reason"
              value={form.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              rows={3}
              placeholder={t('leave.reasonPlaceholder', 'Add an optional note for your manager...')}
              style={{
                width: '100%', padding: '7px 10px', resize: 'vertical',
                border: `1px solid ${ind.hairline}`, borderRadius: 0,
                background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 12.5,
              }}
            />
          </div>

          {canManageLeave && (
            <button
              type="button"
              onClick={() => handleChange('autoApprove', !form.autoApprove)}
              aria-pressed={form.autoApprove}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                padding: '10px 12px', borderRadius: 0, cursor: 'pointer',
                border: `1px solid ${form.autoApprove ? ind.accent : ind.hairline}`,
                background: form.autoApprove ? ind.accentWash : 'transparent',
              }}
            >
              <span
                style={{
                  width: 15, height: 15, flex: 'none', marginTop: 2, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${form.autoApprove ? ind.accent : ind.hairline}`,
                  background: form.autoApprove ? ind.accent : 'transparent',
                  color: ind.accentInk,
                }}
              >
                {form.autoApprove && <Check size={10} strokeWidth={2} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="inline-flex items-center" style={{ gap: 6 }}>
                  <ShieldCheck size={13} strokeWidth={1.5} style={{ color: ind.accentDeep }} />
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: ind.ink }}>
                    {t('leave.autoApprove', 'Approve immediately')}
                  </span>
                </span>
                <span className="block" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 3 }}>
                  {t('leave.autoApproveHint', 'Skip the pending queue and mark this request as approved.')}
                </span>
              </span>
            </button>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end" style={{ gap: 8, paddingTop: 4, borderTop: `1px solid ${ind.rule}` }}>
            <Btn ind={ind} onClick={onClose}>{t('common.cancel', 'Cancel')}</Btn>
            <Btn
              ind={ind}
              variant="primary"
              type="submit"
              disabled={loading || dayCount === 0}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {loading && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
              {loading
                ? t('common.saving', 'Saving...')
                : form.autoApprove && canManageLeave
                  ? t('leave.submitAndApprove', 'Submit & Approve')
                  : t('leave.submitRequest', 'Submit Request')}
            </Btn>
          </div>
        </form>
      </Blueprint>
    </div>
  );
};

const RejectLeaveModal = ({ t, ind, employeeName, onClose, onConfirm }) => {
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

  const labelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 4,
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Blueprint ind={ind} style={{ background: ind.ground, width: '100%', maxWidth: 420 }}>
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="flex items-start justify-between" style={{ gap: 10 }}>
            <ColumnHeading ind={ind}>{t('leave.rejectTitle', 'Reject Leave Request')}</ColumnHeading>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, margin: 0, lineHeight: 1.5 }}>
            {(t('leave.rejectConfirm', 'Reject leave for {{name}}?')).replace('{{name}}', employeeName)}
          </p>

          <div>
            <label htmlFor="reject-reason" style={labelStyle}>{t('leave.rejectReasonLabel', 'Reason (optional)')}</label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('leave.rejectReasonPlaceholder', 'Explain why this request is being rejected...')}
              style={{
                width: '100%', padding: '7px 10px', resize: 'vertical',
                border: `1px solid ${ind.hairline}`, borderRadius: 0,
                background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 12.5,
              }}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end" style={{ gap: 8, paddingTop: 4, borderTop: `1px solid ${ind.rule}` }}>
            <Btn ind={ind} onClick={onClose}>{t('common.cancel', 'Cancel')}</Btn>
            {/* Rejection is the loud action here, so it takes the ink outline
                rather than the accent fill an approval would get. */}
            <Btn
              ind={ind}
              type="submit"
              disabled={loading}
              style={{ borderColor: ind.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {loading && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
              {loading ? t('common.saving', 'Saving...') : t('leave.confirmReject', 'Reject Request')}
            </Btn>
          </div>
        </form>
      </Blueprint>
    </div>
  );
};

export default LeaveManagement;
