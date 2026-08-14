/**
 * Time Tracking — direction 2a, "Load against contract".
 *
 * Three vertical bands, the same grammar as the rest of the console: the app
 * rail (sidebar.jsx) → this main column → the 340px exceptions column, with a
 * 44px steel ticker spanning both. The ticker replaces metric cards; per the
 * spec the console never shows both.
 *
 * The central idea of this screen: rather than nine identical KPI cards, one
 * dense chart plots every employee's month as a stacked bar against the
 * contract line, and the table below it carries a load meter per row. The right
 * column is not a passive list — it is the set of things that must be fixed
 * before payroll closes.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through
 * weight and rule rather than colour.
 */
import _React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search, Download, ChevronRight, AlertCircle, X, Check, RefreshCw, Coffee,
  CircleQuestionMark,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import * as timeTrackingService from '../services/timeTrackingService'
import { supabase } from '../config/supabaseClient'
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js'
import { getDemoEmployeeName, isDemoMode, addDemoLeaveRequest, updateDemoLeaveRequest, calculateDaysBetween } from '../utils/demoHelper'
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts'
import { DatePicker } from './ui/date-picker.jsx';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { COL } from '../utils/tableColumns.js';
import { TableScroll, StackedDetail } from './ui/responsive-table.jsx';
import { cn } from '@/lib/utils';
import { FlubberMorphIcon } from './ui/flubber-morph-icon.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill'
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js'
import {
  Blueprint, Bar, Tag, Btn, Seg, Kicker, TickerCell, ColumnHeading,
  LiveClock, FlatSelect,
} from './ui/industry.jsx'

/* ------------------------------------------------------------------ *
 * Icons re-exported through components/index.jsx — keep both exports.
 * ------------------------------------------------------------------ */

// Static, so it is defined once at module scope instead of being rebuilt and
// re-injected as a <style> element on every render. Steam inherits the parent's
// currentColor rather than baking the theme into the stylesheet text.
const COFFEE_STEAM_STYLES = `
        @keyframes steam-rise {
            /* Start: Mostly transparent, at base level */
            0%, 100% {
                opacity: 0;
                transform: translateY(0);
            }
            /* Peak Opacity: Steam becomes visible */
            10% {
                opacity: 0.8;
            }
            /* Halfway: Moves up and starts fading */
            50% {
                opacity: 0.5;
                transform: translateY(-1.5px);
            }
            /* End of movement cycle: Fades out completely, max rise of ~2px */
            80% {
                opacity: 0.05;
                transform: translateY(-2.5px);
            }
        }

        .steam-line {
            stroke: currentColor;
            stroke-linecap: round;
            stroke-width: 2;
            fill: none;
            /* 3s duration, repeats infinitely, uses a subtle ease-out */
            animation: steam-rise 3s infinite ease-out;
        }
    `;

export const AnimatedCoffeeIcon = ({ size = 40, className = '', isDarkMode = false }) => {
    const mainColor = isDarkMode ? '#ffffff' : '#000000';
    const steamColor = isDarkMode ? '#e5e7eb' : '#000000';

    return (
        <div
            className={`relative ${className}`}
            style={{ width: size, height: size, color: steamColor }}
        >
            <style>{COFFEE_STEAM_STYLES}</style>

            <Coffee size={size} strokeWidth={1.5} stroke={mainColor}/>
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                className="absolute top-0 left-0"
                stroke={mainColor}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >

                {/* Steam Bar 1 (Left) - Delayed start */}
                <line x1="6" y1="10" x2="6" y2="10" className="steam-line" style={{ animationDelay: '0.6s' }} />
                {/* Steam Bar 2 (Center) - Instant start */}
                <line x1="9" y1="10" x2="9" y2="10" className="steam-line" style={{ animationDelay: '0s' }} />
                {/* Steam Bar 3 (Right) - Heaviest delay */}
                <line x1="12" y1="10" x2="12" y2="10" className="steam-line" style={{ animationDelay: '1.2s' }} />
                {/* Steam Bar 4 (Right) - Heaviest delay */}
                <line x1="15" y1="10" x2="15" y2="10" className="steam-line" style={{ animationDelay: '0.9s' }} />

            </svg>
        </div>
    );
};

const LEAVE_STATUS_ORDER = ['pending', 'approved', 'rejected'];
const LEAVE_STATUS_ICONS = [CircleQuestionMark, Check, X];

export const MiniFlubberMorphingLeaveStatus = ({ status = 'pending', isDarkMode = false, ...props }) => {
  const statusColor = (i) => {
    if (LEAVE_STATUS_ORDER[i] === 'approved') return isDarkMode ? 'text-green-400' : 'text-green-700';
    if (LEAVE_STATUS_ORDER[i] === 'rejected') return isDarkMode ? 'text-red-400' : 'text-red-700';
    return isDarkMode ? 'text-gray-300' : 'text-gray-400';
  };

  const index = Math.max(0, LEAVE_STATUS_ORDER.indexOf(status));

  return (
    <FlubberMorphIcon
      icons={LEAVE_STATUS_ICONS}
      cacheKey="leave-status"
      mode="index"
      index={index}
      morphDuration={3000}
      getColor={statusColor}
      isDarkMode={isDarkMode}
      {...props}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Screen constants — the policy this screen reads against
 * ------------------------------------------------------------------ */

/** Contract day. Everything on this screen is measured against days × 8h. */
const CONTRACT_HOURS_PER_DAY = 8;
/**
 * Where the contract sits on the load meter's track. Leaving 17% of the track
 * above it is what lets an over-contract month read as over rather than full.
 */
const CONTRACT_TICK = 0.83;
/** Shift start and the grace window before a punch counts as late. */
const SHIFT_START_MIN = 9 * 60;
const LATE_GRACE_MIN = 5;
/** A full extra day of overtime — the point at which the number is worth bolding. */
const MATERIAL_OVERTIME_H = 8;
/** Default monthly overtime cap; editable from the exceptions column. */
const DEFAULT_OVERTIME_CAP_H = 20;
const OVERTIME_CAP_KEY = 'hr.timeTracking.overtimeCap';
/** Payroll closes on this day of the month following the period. */
const PAYROLL_CLOSE_DAY = 3;
/** hour_type values that are overtime rather than contracted time. */
const OVERTIME_TYPES = new Set(['overtime', 'weekend', 'bonus', 'holiday']);
const LEAVE_TYPES = new Set(['on_leave', 'vacation', 'sick_leave']);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Mon–Fri count for a 1-indexed month. The contract's denominator. */
const countWorkingDays = (month, year) => {
  const last = new Date(year, month, 0).getDate();
  let n = 0;
  for (let day = 1; day <= last; day += 1) {
    const wd = new Date(year, month - 1, day).getDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
};

/** 'HH:MM[:SS]' → minutes past midnight, or null when unparseable. */
const clockMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':');
  const hours = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
};

/**
 * The standard working day, and the frame an auto-close snaps an open punch to.
 * A clock-in earlier than the start is treated as the start: auto-close fills in
 * a punch nobody made, so it should credit the standard day rather than an
 * unverified early arrival.
 */
const WORKDAY_START = '08:30:00';
const WORKDAY_END = '17:00:00';
const WORKDAY_START_MINUTES = 8 * 60 + 30;
const WORKDAY_END_MINUTES = 17 * 60;
/**
 * 'HH:MM:SS' → 'HH:MM', for the confirm prompt and the button label. 24-hour to
 * match how every other time on this screen and in the Vietnamese copy reads.
 */
const shortTime = (value) => String(value).slice(0, 5);

/** Monday 00:00 of the week containing `now`. */
const startOfWeek = (now) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - shift);
  return d;
};

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const fmt1 = (n) => round1(n).toFixed(1);
const fmtHours = (n) => `${Math.round(Number(n) || 0).toLocaleString()}h`;

const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

/** Chart tooltip in the Industry idiom: hairline box, zero radius, no shadow. */
function IndustryTooltip({ ind, active, payload, contractHours, labels }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div style={{ background: ind.chrome, border: `1px solid ${ind.ink}`, borderRadius: 0, padding: '8px 10px', minWidth: 170 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink }}>
        {row.name}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, marginTop: 2 }}>{row.departmentLabel}</div>
      {[
        { label: labels.regular, value: `${fmt1(row.regular)}h` },
        { label: labels.overtime, value: `${fmt1(row.overtime)}h` },
        { label: labels.load, value: `${Math.round(row.load * 100)}% ${labels.ofContract} ${contractHours}h` },
      ].map((line) => (
        <div key={line.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, marginTop: 4 }}>
          <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>{line.label}</span>
          <span style={{ ...figure(13, ind.ink) }}>{line.value}</span>
        </div>
      ))}
    </div>
  );
}

/** One labelled hairline bar in the attendance block. */
function AttendanceBar({ ind, label, value, share, fill }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost }}>{label}</span>
        <span style={figure(13, ind.ink)}>{value}</span>
      </div>
      <Bar ind={ind} value={share} fill={fill} height={7} />
    </div>
  );
}

/**
 * A one-line exception: title, detail, chevron. Compact by design — these are
 * the cases that are real but not yet urgent.
 */
function ExceptionRow({ ind, title, detail, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '12px 20px', textAlign: 'left', cursor: 'pointer',
        background: active ? ind.hover : 'transparent',
        border: 'none', borderBottom: `1px solid ${ind.rule}`,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: DISPLAY, fontWeight: 600, fontSize: 13.5,
          letterSpacing: '.04em', textTransform: 'uppercase', color: ind.ink,
        }}>
          {title}
        </span>
        <span style={{ display: 'block', fontFamily: BODY, fontSize: 12, color: ind.inkMuted, marginTop: 2 }}>
          {detail}
        </span>
      </span>
      <ChevronRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Time Tracking
 * ------------------------------------------------------------------ */

const TimeTracking = ({ employees: employeesProp }) => {
  // Memoized because this array feeds the effect/callback dependency arrays
  // below: a fresh identity on every render restarts each fetch mid-flight,
  // which is what left the page stuck on its loading state.
  const employees = useMemo(() => filterActiveEmployees(employeesProp), [employeesProp]);
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();
  const { isDarkMode, input } = useTheme();
  const { t } = useLanguage();

  const ind = getIndustry(isDarkMode);
  /**
   * Dark steel is the heavy half of every stacked pair. On the dark theme the
   * literal #1d2d3d would vanish into the ground, so the bright end of the ramp
   * takes over the same job: maximum contrast against whatever the page is.
   */
  const heavyInk = isDarkMode ? ind.accentDeeper : ind.tickerBg;
  const lightSteel = ind.ramp[3];

  // Overview and the exceptions column are org-wide reads — admin/manager only.
  const canViewOverview = checkPermission('canViewReports');

  // Auto-detect current logged-in user's employee_id
  const getCurrentEmployeeId = () => {
    if (user?.employeeId) {
      const userEmployee = employees.find(emp => String(emp.id) === String(user.employeeId));
      if (userEmployee) return String(user.employeeId);
    }
    return employees[0]?.id != null ? String(employees[0].id) : '';
  };

  const [selectedEmployee, setSelectedEmployee] = useState(() => getCurrentEmployeeId());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed for Supabase
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState(() => (checkPermission('canViewReports') ? 'overview' : 'summary'));

  // Timesheets table
  const [sortKey, setSortKey] = useState('total_hours');
  const [sortDirection, setSortDirection] = useState('desc');
  const [tableQuery, setTableQuery] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);
  /** null | 'missingPunch' | 'overCap' | 'unapprovedOvertime' | 'underContract' */
  const [exceptionFilter, setExceptionFilter] = useState(null);

  // Loading and data states
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [leaveSortKey, setLeaveSortKey] = useState('start_date');
  const [leaveSortDirection, setLeaveSortDirection] = useState('asc');
  const [processingRequests, setProcessingRequests] = useState({}); // { [requestId]: true }
  const [timeEntries, setTimeEntries] = useState([]);
  const [allEmployeesData, setAllEmployeesData] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [orgEntries, setOrgEntries] = useState([]);
  const [prevOvertime, setPrevOvertime] = useState(null);
  const [closingPunches, setClosingPunches] = useState(false);
  const overviewCacheRef = useRef({ key: '', data: [] });

  /** Review threshold, not a database policy — kept where the reviewer set it. */
  const [overtimeCap, setOvertimeCap] = useState(() => {
    const stored = Number(localStorage.getItem(OVERTIME_CAP_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_OVERTIME_CAP_H;
  });

  // Modal states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Auto-select current user when auth/employees load
  useEffect(() => {
    if (selectedEmployee) return;
    if (user?.employeeId) {
      setSelectedEmployee(String(user.employeeId));
    } else if (employees[0]?.id != null) {
      setSelectedEmployee(String(employees[0].id));
    }
  }, [user, employees, selectedEmployee]);

  // Guard long-running network calls so UI can recover if Supabase hangs
  const withTimeout = useCallback(async (promiseOrFactory, ms = DEFAULT_REQUEST_TIMEOUT, label = 'request') => {
    const controller = new AbortController();
    const makePromise = () => (typeof promiseOrFactory === 'function' ? promiseOrFactory(controller.signal) : promiseOrFactory);

    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Timeout: ${label} exceeded ${ms}ms`));
      }, ms);
    });

    try {
      return await Promise.race([makePromise(), timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // ---------------------------------------------------------------- period

  const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const monthEnd = iso(new Date(selectedYear, selectedMonth, 0));
  const workingDays = useMemo(() => countWorkingDays(selectedMonth, selectedYear), [selectedMonth, selectedYear]);
  const contractHours = workingDays * CONTRACT_HOURS_PER_DAY;

  // ---------------------------------------------------------------- fetch

  const fetchTimeTrackingData = useCallback(async ({ silent = false } = {}) => {
    if (!selectedEmployee) {
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setFetchError(null);
    }
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      const [summaryResult, leaveResult, entriesResult] = await Promise.all([
        withTimeout(
          () => timeTrackingService.getTimeTrackingSummary(selectedEmployee, selectedMonth, selectedYear),
          DEFAULT_REQUEST_TIMEOUT,
          'load time tracking summary'
        ),
        withTimeout(
          () => timeTrackingService.getLeaveRequests(selectedEmployee, { year: selectedYear }),
          DEFAULT_REQUEST_TIMEOUT,
          'load leave requests (selected employee)'
        ),
        withTimeout(
          () => timeTrackingService.getTimeEntries(selectedEmployee, { startDate, endDate }),
          DEFAULT_REQUEST_TIMEOUT,
          'load time entries (selected employee)'
        ),
      ]);

      if (summaryResult.success) {
        setSummaryData(summaryResult.data);
      }
      if (leaveResult.success) {
        setLeaveRequests(leaveResult.data);
      }
      if (entriesResult.success) {
        setTimeEntries(entriesResult.data);
      }
    } catch (error) {
      console.error('Error fetching time tracking data:', error);

      if (handleSessionAuthError(error, { silent, setFetchError })) {
        return;
      }

      if (!silent) {
        setFetchError(t('errors.loadFailed', 'Failed to load data'));
      }
      setSuccessMessage('');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedEmployee, selectedMonth, selectedYear, withTimeout, handleSessionAuthError]);

  // Fetch data from Supabase when employee or period changes
  useEffect(() => {
    fetchTimeTrackingData();
  }, [fetchTimeTrackingData]);

  // Use visibility refresh hook to reload data when page becomes visible after idle.
  // Kept stable so the hook's listeners and staleness interval survive re-renders.
  const silentRefresh = useCallback(
    () => fetchTimeTrackingData({ silent: true }),
    [fetchTimeTrackingData]
  );
  useAuthenticatedPageRefresh(silentRefresh);

  /**
   * Org-wide summaries. Not gated on the active tab any more: the ticker and the
   * exceptions column are on screen whatever tab is showing, and both read these.
   */
  const fetchOrgSummaries = useCallback(async () => {
    if (!canViewOverview || employees.length === 0) return;

    const cacheKey = `${selectedYear}-${selectedMonth}-${employees.length}`;
    if (overviewCacheRef.current.key === cacheKey) {
      setAllEmployeesData(overviewCacheRef.current.data);
      return;
    }

    setOverviewLoading(true);
    try {
      const result = await timeTrackingService.getOverviewEmployeeSummaries(
        selectedMonth,
        selectedYear,
        employees
      );
      if (!result.success) return;
      overviewCacheRef.current = { key: cacheKey, data: result.data };
      setAllEmployeesData(result.data);
    } catch (error) {
      console.error('Error fetching overview data:', error);
      handleSessionAuthError(error, { silent: true });
    } finally {
      setOverviewLoading(false);
    }
  }, [canViewOverview, employees, selectedMonth, selectedYear, handleSessionAuthError]);

  useEffect(() => { fetchOrgSummaries(); }, [fetchOrgSummaries]);

  /**
   * Raw punches for the exceptions column. The range covers both the selected
   * period and the current week, because "attendance, this week" always means
   * this week regardless of which month the period picker is showing.
   */
  const fetchOrgEntries = useCallback(async () => {
    if (!canViewOverview) return;

    const now = new Date();
    const weekStart = iso(startOfWeek(now));
    const today = iso(now);
    const startDate = monthStart < weekStart ? monthStart : weekStart;
    const endDate = monthEnd > today ? monthEnd : today;

    try {
      const result = await withTimeout(
        () => timeTrackingService.getAllTimeEntriesDetailed({ startDate, endDate }),
        DEFAULT_REQUEST_TIMEOUT,
        'load org time entries'
      );
      setOrgEntries(result.success && Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching org time entries:', error);
      handleSessionAuthError(error, { silent: true });
      setOrgEntries([]);
    }
  }, [canViewOverview, monthStart, monthEnd, withTimeout, handleSessionAuthError]);

  useEffect(() => { fetchOrgEntries(); }, [fetchOrgEntries]);

  /**
   * Prior period overtime, for the ticker's delta. Deliberately non-blocking:
   * any failure just means the delta stays hidden.
   */
  useEffect(() => {
    if (!canViewOverview || employees.length === 0) return undefined;
    let cancelled = false;

    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

    (async () => {
      try {
        const result = await timeTrackingService.getOverviewEmployeeSummaries(prevMonth, prevYear, employees);
        if (cancelled || !result?.success) return;
        const rows = (result.data || []).map((item) => item.data).filter(Boolean);
        if (rows.length === 0) { setPrevOvertime(null); return; }
        setPrevOvertime(rows.reduce((s, d) => s + (d.overtime_hours || 0) + (d.holiday_overtime_hours || 0), 0));
      } catch {
        if (!cancelled) setPrevOvertime(null); // the delta is optional
      }
    })();

    return () => { cancelled = true; };
  }, [canViewOverview, employees, selectedMonth, selectedYear]);

  // Leave requests across the org. Pending requests are always included so
  // approvals dated outside the year stay actionable.
  const fetchAllLeaveRequests = useCallback(async () => {
    if (!canViewOverview) return;

    try {
      const result = await withTimeout(
        () => timeTrackingService.getAllLeaveRequests({
          year: selectedYear,
          alwaysIncludeStatus: 'pending',
        }),
        DEFAULT_REQUEST_TIMEOUT,
        'fetch all leave requests'
      );
      setAllLeaveRequests(result.success && Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Error fetching all leave requests:', error);
      handleSessionAuthError(error, { silent: true });
      setAllLeaveRequests([]);
    }
  }, [canViewOverview, selectedYear, withTimeout, handleSessionAuthError]);

  useEffect(() => { fetchAllLeaveRequests(); }, [fetchAllLeaveRequests]);

  // Subscribe to leave request changes so approvals sync automatically
  useEffect(() => {
    if (isDemoMode()) return undefined;

    const channel = supabase
      .channel('leave-requests-changes-timetracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchTimeTrackingData({ silent: true });
        fetchAllLeaveRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTimeTrackingData, fetchAllLeaveRequests]);

  // ---------------------------------------------------------------- actions

  const handleApproveRequest = async (requestId) => {
    if (!user?.employeeId) {
      setSuccessMessage(t('timeTracking.actionError', 'Unable to determine approver'));
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    setProcessingRequests(prev => ({ ...prev, [requestId]: true }));

    try {
      if (isDemoMode()) {
        // Persist approval in demo storage and update local state
        try {
          const updated = updateDemoLeaveRequest(requestId, {
            status: 'approved',
            approved_by_name: user?.name || '-',
            updated_at: new Date().toISOString()
          });

          if (updated) {
            setAllLeaveRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updated } : r));
            setSuccessMessage(t('timeTracking.approveSuccess', 'Request approved'));
          } else {
            setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
          }
        } catch (err) {
          console.error('Demo approve error:', err);
          setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
        }
      } else {
        const result = await timeTrackingService.updateLeaveRequestStatus(requestId, 'approved', user.employeeId);

        if (result.success) {
          // Only update the specific request - preserve object references for others
          setAllLeaveRequests(prev => prev.map(r => {
            if (r.id === requestId) {
              const updated = result.data || {};
              return {
                ...r,
                ...updated,
                status: 'approved',
                approved_by_name: updated.approved_by_name || (user?.name || '-')
              };
            }
            return r; // Keep same reference for unchanged items
          }));

          setSuccessMessage(t('timeTracking.approveSuccess', 'Request approved'));
        } else {
          console.error('Failed to update leave request:', result.error);
          setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
        }
      }
    } catch (error) {
      console.error('Error approving leave request:', error);
      if (handleSessionAuthError(error, { silent: true })) return;
      setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
    } finally {
      setProcessingRequests(prev => {
        const copy = { ...prev };
        delete copy[requestId];
        return copy;
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!user?.employeeId) {
      setSuccessMessage(t('timeTracking.actionError', 'Unable to determine approver'));
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    const reason = window.prompt(t('timeTracking.rejectReasonPrompt', 'Please enter a reason for rejection (optional):'));
    if (reason === null) return;

    setProcessingRequests(prev => ({ ...prev, [requestId]: true }));

    try {
      if (isDemoMode()) {
        try {
          const updated = updateDemoLeaveRequest(requestId, {
            status: 'rejected',
            rejection_reason: reason || null,
            updated_at: new Date().toISOString()
          });

          if (updated) {
            setAllLeaveRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updated } : r));
            setSuccessMessage(t('timeTracking.rejectSuccess', 'Request rejected'));
          } else {
            setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
          }
        } catch (err) {
          console.error('Demo reject error:', err);
          setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
        }
      } else {
        const result = await timeTrackingService.updateLeaveRequestStatus(requestId, 'rejected', user.employeeId, reason || null);

        if (result.success) {
          // Only update the specific request - preserve object references for others
          setAllLeaveRequests(prev => prev.map(r => {
            if (r.id === requestId) {
              const updated = result.data || {};
              return { ...r, ...updated, status: 'rejected' };
            }
            return r; // Keep same reference for unchanged items
          }));

          setSuccessMessage(t('timeTracking.rejectSuccess', 'Request rejected'));
        } else {
          console.error('Failed to update time request:', result.error);
          setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
        }
      }
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      if (handleSessionAuthError(error, { silent: true })) return;
      setSuccessMessage(t('timeTracking.actionError', 'Error updating request'));
    } finally {
      setProcessingRequests(prev => {
        const copy = { ...prev };
        delete copy[requestId];
        return copy;
      });
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Demo mode: persist leave request locally and update state
      if (isDemoMode()) {
        const daysCount = calculateDaysBetween(leaveForm.startDate, leaveForm.endDate);
        const newLeaveRequest = {
          id: `demo-leave-${Date.now()}`,
          employee_id: selectedEmployee,
          leave_type: leaveForm.type,
          type: leaveForm.type,
          start_date: leaveForm.startDate,
          end_date: leaveForm.endDate,
          reason: leaveForm.reason,
          days_count: daysCount,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        try {
          addDemoLeaveRequest(newLeaveRequest);
        } catch (err) {
          console.error('Failed to save demo leave request:', err);
        }

        setLeaveRequests(prev => Array.isArray(prev) ? [...prev, newLeaveRequest] : [newLeaveRequest]);
        setAllLeaveRequests(prev => Array.isArray(prev) ? [...prev, newLeaveRequest] : [newLeaveRequest]);

        setSuccessMessage(t('timeTracking.leaveSuccess', 'Leave request submitted successfully!'));
        setShowLeaveModal(false);
        setLeaveForm({ type: 'vacation', startDate: '', endDate: '', reason: '' });
        setLoading(false);
        setTimeout(() => setSuccessMessage(''), 3000);
        return;
      }

      const result = await timeTrackingService.createLeaveRequest({
        employeeId: selectedEmployee,
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason
      });

      if (result.success) {
        setSuccessMessage(t('timeTracking.leaveSuccess', 'Leave request submitted successfully!'));
        setShowLeaveModal(false);

        // Refresh leave requests and summary data
        const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, { year: selectedYear });
        if (leaveResult.success) setLeaveRequests(leaveResult.data);

        // Refresh summary to update leave days count
        const summaryResult = await timeTrackingService.getTimeTrackingSummary(selectedEmployee, selectedMonth, selectedYear);
        if (summaryResult.success) setSummaryData(summaryResult.data);

        setLeaveForm({ type: 'vacation', startDate: '', endDate: '', reason: '' });
      } else {
        setSuccessMessage(t('timeTracking.leaveError', 'Error submitting leave request'));
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      if (handleSessionAuthError(error, { silent: true })) return;
      setSuccessMessage(t('timeTracking.leaveError', 'Error submitting leave request'));
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'employee' || key === 'department' ? 'asc' : 'desc');
    }
  };

  const handleLeaveSort = (key) => {
    if (leaveSortKey === key) {
      setLeaveSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLeaveSortKey(key);
      setLeaveSortDirection('asc');
    }
  };

  // ---------------------------------------------------------------- derive

  const monthNames = [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'),
    t('months.may'), t('months.june'), t('months.july'), t('months.august'),
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ];
  const getMonthName = (monthIndex) => monthNames[monthIndex - 1] || monthNames[0];
  const periodLabel = `${getMonthName(selectedMonth)} ${selectedYear}`;

  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];

  /** One row per employee: the shape both the chart and the table read. */
  const orgRows = useMemo(() => allEmployeesData
    .filter((item) => item.data && item.employee)
    .map((item) => {
      const d = item.data;
      const regular = d.regular_hours || 0;
      const overtime = (d.overtime_hours || 0) + (d.holiday_overtime_hours || 0);
      const total = d.total_hours || (regular + overtime);
      const department = item.employee.department || '';
      return {
        id: String(item.employee.id),
        employee: item.employee,
        name: getDemoEmployeeName(item.employee, t) || item.employee.name || '—',
        department,
        departmentLabel: department ? t(`employeeDepartment.${department}`, department) : '—',
        days: d.days_worked || 0,
        leaveDays: d.leave_days || 0,
        regular,
        overtime,
        total,
        load: contractHours > 0 ? total / contractHours : 0,
      };
    }), [allEmployeesData, contractHours, t]);

  const orgTotals = useMemo(() => orgRows.reduce((acc, r) => ({
    regular: acc.regular + r.regular,
    overtime: acc.overtime + r.overtime,
    leaveDays: acc.leaveDays + r.leaveDays,
    days: acc.days + r.days,
    total: acc.total + r.total,
  }), { regular: 0, overtime: 0, leaveDays: 0, days: 0, total: 0 }), [orgRows]);

  /** Sorted descending so the bars that cross the contract line group at the left. */
  const chartRows = useMemo(
    () => [...orgRows].sort((a, b) => b.total - a.total),
    [orgRows]
  );
  const overContractCount = useMemo(
    () => orgRows.filter((r) => r.total > contractHours).length,
    [orgRows, contractHours]
  );

  // -- exceptions ----------------------------------------------------

  const monthEntries = useMemo(
    () => orgEntries.filter((e) => e.date >= monthStart && e.date <= monthEnd),
    [orgEntries, monthStart, monthEnd]
  );

  const employeeNameById = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => map.set(String(emp.id), getDemoEmployeeName(emp, t) || emp.name));
    return map;
  }, [employees, t]);

  /** Clocked in, never clocked out. The single biggest payroll blocker. */
  const missingPunch = useMemo(() => {
    const rows = monthEntries.filter((e) =>
      e.clock_in && !e.clock_out && !LEAVE_TYPES.has(e.hour_type)
    );
    const byEmployee = new Map();
    rows.forEach((e) => {
      const id = String(e.employee_id);
      if (!byEmployee.has(id)) {
        byEmployee.set(id, { id, name: e.employee_name || employeeNameById.get(id) || '—', count: 0 });
      }
      byEmployee.get(id).count += 1;
    });
    const dates = rows.map((e) => e.date).filter(Boolean).sort();
    return {
      rows,
      people: Array.from(byEmployee.values()).sort((a, b) => b.count - a.count),
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
    };
  }, [monthEntries, employeeNameById]);

  const overCapRows = useMemo(
    () => orgRows.filter((r) => r.overtime > overtimeCap).sort((a, b) => b.overtime - a.overtime),
    [orgRows, overtimeCap]
  );

  const unapprovedOvertime = useMemo(() => {
    const rows = monthEntries.filter((e) => e.status === 'pending' && OVERTIME_TYPES.has(e.hour_type));
    return {
      rows,
      hours: rows.reduce((s, e) => s + (Number(e.hours) || 0), 0),
      people: new Set(rows.map((e) => String(e.employee_id))).size,
    };
  }, [monthEntries]);

  const underContractRows = useMemo(
    () => orgRows.filter((r) => r.total < contractHours).sort((a, b) => a.total - b.total),
    [orgRows, contractHours]
  );

  /**
   * Attendance for the current week, always — the period picker moves the rest
   * of the screen but "this week" has to mean this week.
   */
  const attendance = useMemo(() => {
    if (!canViewOverview) return null;

    const now = new Date();
    const weekStart = iso(startOfWeek(now));
    const today = iso(now);
    const weekEntries = orgEntries.filter((e) => e.date >= weekStart && e.date <= today);

    const earliestPunch = new Map();
    const excused = new Set();
    weekEntries.forEach((e) => {
      const id = String(e.employee_id);
      if (LEAVE_TYPES.has(e.hour_type)) { excused.add(id); return; }
      const minutes = clockMinutes(e.clock_in);
      if (minutes == null) return;
      const current = earliestPunch.get(id);
      if (current == null || minutes < current) earliestPunch.set(id, minutes);
    });

    // Approved leave also excuses an absence, even with no entry recorded.
    allLeaveRequests.forEach((req) => {
      if (req.status !== 'approved') return;
      if (req.start_date > today || req.end_date < weekStart) return;
      excused.add(String(req.employee_id));
    });

    let onTime = 0;
    let late = 0;
    earliestPunch.forEach((minutes) => {
      if (minutes <= SHIFT_START_MIN + LATE_GRACE_MIN) onTime += 1;
      else late += 1;
    });

    const accountedFor = new Set([...earliestPunch.keys(), ...excused]);
    const absent = Math.max(0, employees.length - accountedFor.size);
    const measured = onTime + late + absent;

    return { onTime, late, absent, onTimeRate: measured > 0 ? (onTime / measured) * 100 : 0 };
  }, [canViewOverview, orgEntries, allLeaveRequests, employees.length]);

  const exceptionCount =
    missingPunch.people.length + overCapRows.length +
    (unapprovedOvertime.rows.length > 0 ? 1 : 0) +
    (underContractRows.length > 0 ? 1 : 0);

  const payrollCloseLabel = useMemo(() => {
    const close = new Date(selectedYear, selectedMonth, PAYROLL_CLOSE_DAY);
    return close.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }, [selectedMonth, selectedYear]);

  const fmtDayMonth = useCallback((value) => {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }, []);

  // -- timesheets table ----------------------------------------------

  const filteredRows = useMemo(() => {
    let rows = orgRows;

    if (exceptionFilter === 'missingPunch') {
      const ids = new Set(missingPunch.people.map((p) => p.id));
      rows = rows.filter((r) => ids.has(r.id));
    } else if (exceptionFilter === 'overCap') {
      rows = overCapRows;
    } else if (exceptionFilter === 'unapprovedOvertime') {
      const ids = new Set(unapprovedOvertime.rows.map((e) => String(e.employee_id)));
      rows = rows.filter((r) => ids.has(r.id));
    } else if (exceptionFilter === 'underContract') {
      rows = underContractRows;
    }

    const q = tableQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(q) || r.departmentLabel.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [orgRows, exceptionFilter, missingPunch.people, overCapRows, unapprovedOvertime.rows, underContractRows, tableQuery]);

  const sortedRows = useMemo(() => {
    const pick = (row) => {
      switch (sortKey) {
        case 'employee': return row.name.toLowerCase();
        case 'department': return row.departmentLabel.toLowerCase();
        case 'days_worked': return row.days;
        case 'regular_hours': return row.regular;
        case 'overtime': return row.overtime;
        case 'load': return row.load;
        case 'total_hours':
        default: return row.total;
      }
    };
    return [...filteredRows].sort((a, b) => {
      const av = pick(a);
      const bv = pick(b);
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortKey, sortDirection]);

  const visibleRows = showAllRows ? sortedRows : sortedRows.slice(0, 10);

  const openException = useCallback((key) => {
    setExceptionFilter((current) => (current === key ? null : key));
    setActiveTab('overview');
    setShowAllRows(true);
  }, []);

  /**
   * Close every open punch at the end of the standard working day. This writes:
   * it is the one action on the screen that changes records rather than
   * filtering them, so it confirms with an explicit count first.
   */
  const handleAutoClose = useCallback(async () => {
    const open = missingPunch.rows;
    if (open.length === 0 || closingPunches) return;

    const confirmed = window.confirm(
      t('timeTracking.autoCloseConfirm', 'Set clock-out to {time} on {count} open entries? This updates the timesheets.')
        .replace('{time}', shortTime(WORKDAY_END))
        .replace('{count}', String(open.length))
    );
    if (!confirmed) return;

    setClosingPunches(true);
    let updated = 0;
    try {
      for (const entry of open) {
        const inMinutes = clockMinutes(entry.clock_in);
        // No lunch deduction — an auto-close is a placeholder for a real punch,
        // not an assertion about how the day was spent. An entry with no
        // readable clock-in is credited the full standard day.
        const startMinutes = Math.max(inMinutes ?? WORKDAY_START_MINUTES, WORKDAY_START_MINUTES);
        const hours = Math.max(0, round1((WORKDAY_END_MINUTES - startMinutes) / 60));
        const result = await timeTrackingService.updateTimeEntry(entry.id, {
          clockOut: WORKDAY_END,
          hours,
        });
        if (result.success) updated += 1;
      }
      setSuccessMessage(
        t('timeTracking.autoCloseSuccess', '{count} entries closed at {time}')
          .replace('{count}', String(updated))
          .replace('{time}', shortTime(WORKDAY_END))
      );
      overviewCacheRef.current = { key: '', data: [] };
      await Promise.all([fetchOrgEntries(), fetchOrgSummaries(), fetchTimeTrackingData({ silent: true })]);
    } catch (error) {
      console.error('Error auto-closing punches:', error);
      if (!handleSessionAuthError(error, { silent: true })) {
        setSuccessMessage(t('timeTracking.actionError', 'Error updating entries'));
      }
    } finally {
      setClosingPunches(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  }, [missingPunch.rows, closingPunches, t, fetchOrgEntries, fetchOrgSummaries, fetchTimeTrackingData, handleSessionAuthError]);

  const handleRaiseCap = useCallback(() => {
    const answer = window.prompt(
      t('timeTracking.raiseCapPrompt', 'Monthly overtime cap, in hours:'),
      String(overtimeCap)
    );
    if (answer === null) return;
    const next = Number(answer);
    if (!Number.isFinite(next) || next <= 0) return;
    setOvertimeCap(next);
    localStorage.setItem(OVERTIME_CAP_KEY, String(next));
  }, [overtimeCap, t]);

  // -- selected employee (Summary tab) --------------------------------

  const calculatedLeaveDays = useMemo(() => {
    if (!leaveRequests || leaveRequests.length === 0) return 0;

    return leaveRequests.reduce((total, req) => {
      // Include pending and approved, exclude rejected
      if (req.status === 'rejected') return total;

      const startDate = new Date(req.start_date);
      if (startDate.getFullYear() === selectedYear && startDate.getMonth() + 1 === selectedMonth) {
        return total + (req.days_count || 0);
      }
      return total;
    }, 0);
  }, [leaveRequests, selectedMonth, selectedYear]);

  // Prefer live tally from loaded time entries so UI metrics match the table
  const entryDerivedHours = useMemo(() => {
    const entries = timeEntries || [];
    let regular = 0;
    let overtime = 0;
    let holidayOvertime = 0;
    const workDays = new Set();

    entries.forEach((entry) => {
      const type = entry.hour_type || entry.hourType;
      const hours = Number(entry.hours) || 0;
      if (LEAVE_TYPES.has(type)) return;
      if (entry.date) workDays.add(entry.date);

      if (type === 'regular' || type === 'wfh') regular += hours;
      else if (type === 'overtime' || type === 'weekend' || type === 'bonus') overtime += hours;
      else if (type === 'holiday') holidayOvertime += hours;
      else regular += hours;
    });

    return {
      regular_hours: Math.round(regular * 100) / 100,
      overtime_hours: Math.round(overtime * 100) / 100,
      holiday_overtime_hours: Math.round(holidayOvertime * 100) / 100,
      total_hours: Math.round((regular + overtime + holidayOvertime) * 100) / 100,
      days_worked: workDays.size,
    };
  }, [timeEntries]);

  const currentData = {
    days_worked: 0,
    overtime_hours: 0,
    holiday_overtime_hours: 0,
    regular_hours: 0,
    total_hours: 0,
    attendance_rate: 0,
    ...(summaryData || {}),
    // Live entries win when present (fixes stale / mis-aggregated overtime)
    ...(timeEntries?.length
      ? {
          regular_hours: entryDerivedHours.regular_hours,
          overtime_hours: entryDerivedHours.overtime_hours,
          holiday_overtime_hours: entryDerivedHours.holiday_overtime_hours,
          total_hours: entryDerivedHours.total_hours,
          days_worked: entryDerivedHours.days_worked || summaryData?.days_worked || 0,
        }
      : {}),
    // Always use calculated leave (overrides summaryData defaults)
    leave_days: calculatedLeaveDays,
  };

  // Memoized so the export callback below keeps a stable identity.
  const attendanceRecords = useMemo(() => timeEntries || [], [timeEntries]);
  const selectedEmployeeName = employees.find((emp) => String(emp.id) === selectedEmployee)?.name || '—';
  const ownOvertime = (currentData.overtime_hours || 0) + (currentData.holiday_overtime_hours || 0);

  const sortedLeaveRequests = useMemo(() => {
    const sorted = [...allLeaveRequests];
    sorted.sort((a, b) => {
      let aVal;
      let bVal;
      switch (leaveSortKey) {
        case 'days_count':
          aVal = a.days_count || 0;
          bVal = b.days_count || 0;
          break;
        case 'leave_type':
          aVal = (a.leave_type || '').toLowerCase();
          bVal = (b.leave_type || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'requested_by':
          aVal = (a.employee?.name || '').toLowerCase();
          bVal = (b.employee?.name || '').toLowerCase();
          break;
        case 'approved_by':
          aVal = (a.approved_by_name || '').toLowerCase();
          bVal = (b.approved_by_name || '').toLowerCase();
          break;
        case 'start_date':
        default:
          aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
          bVal = b.start_date ? new Date(b.start_date).getTime() : 0;
      }

      if (aVal < bVal) return leaveSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return leaveSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [allLeaveRequests, leaveSortKey, leaveSortDirection]);

  // -- export ---------------------------------------------------------

  const handleExport = useCallback(() => {
    let header = [];
    let body = [];
    let name = 'time-tracking';

    if (activeTab === 'leaveRequests') {
      name = 'leave-requests';
      header = ['Employee', 'Type', 'Start', 'End', 'Days', 'Status', 'Approved by'];
      body = sortedLeaveRequests.map((r) => [
        r.employee?.name || '', r.leave_type || '', r.start_date || '', r.end_date || '',
        r.days_count ?? '', r.status || '', r.approved_by_name || '',
      ]);
    } else if (activeTab === 'overview') {
      name = 'timesheets';
      header = ['Employee', 'Department', 'Days', 'Regular', 'Overtime', 'Total', 'Load %'];
      body = sortedRows.map((r) => [
        r.name, r.departmentLabel, r.days, fmt1(r.regular), fmt1(r.overtime), fmt1(r.total),
        Math.round(r.load * 100),
      ]);
    } else {
      name = 'timesheet-detail';
      header = ['Date', 'Employee', 'Clock in', 'Clock out', 'Hour type', 'Hours'];
      body = attendanceRecords.map((r) => [
        r.date || '', selectedEmployeeName, r.clock_in || r.clockIn || '',
        r.clock_out || r.clockOut || '', r.hour_type || r.hourType || '', r.hours ?? '',
      ]);
    }

    // BOM so Excel reads the Vietnamese names as UTF-8.
    const csv = '\ufeff' + [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setSuccessMessage(t('timeTracking.exportSuccess', 'Report exported successfully!'));
    setTimeout(() => setSuccessMessage(''), 3000);
  }, [activeTab, sortedLeaveRequests, sortedRows, attendanceRecords, selectedEmployeeName, selectedMonth, selectedYear, t]);

  // ---------------------------------------------------------------- style

  const hasRealData = orgRows.length > 0 || attendanceRecords.length > 0;

  /** `edge` drops the outer padding so the first and last columns sit flush. */
  const th = (align = 'left', edge) => ({
    textAlign: align,
    paddingTop: 0,
    paddingBottom: 7,
    paddingLeft: edge === 'first' ? 0 : 8,
    paddingRight: edge === 'last' ? 0 : 8,
    borderBottom: `1px solid ${ind.hairline}`,
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: ind.inkMuted,
    whiteSpace: 'nowrap',
  });

  const sortCaret = (key) => (sortKey === key ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '');

  const tabOptions = [
    { value: 'summary', label: t('timeTracking.summary', 'Summary') },
    ...(canViewOverview
      ? [
          { value: 'overview', label: t('timeTracking.overview', 'Overview') },
          { value: 'leaveRequests', label: t('timeTracking.leaveRequests', 'Leave requests') },
        ]
      : []),
  ];

  const chartLabels = {
    regular: t('timeTracking.regularHours', 'Regular Hours'),
    overtime: t('timeTracking.overtime', 'Overtime'),
    load: t('timeTracking.load', 'Load'),
    ofContract: t('timeTracking.ofContract', 'of'),
  };

  return (
    <div
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER — replaces metric cards. Never both. ───────────────── */}
      <div
        style={{
          height: 44,
          background: ind.tickerBg,
          color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind} title={hasRealData ? t('dashboard.liveData', 'Live data from Supabase') : t('dashboard.noData', 'No time tracking data yet')}>
          <LiveClock ind={ind} live={hasRealData} />
        </TickerCell>

        <TickerCell
          ind={ind}
          label={t('timeTracking.workDays', 'Work Days')}
          value={workingDays}
          title={t('timeTracking.workingDaysInPeriod', 'Working days in this period')}
        />
        <TickerCell
          ind={ind}
          label={t('timeTracking.regularHours', 'Regular')}
          value={fmtHours(canViewOverview ? orgTotals.regular : currentData.regular_hours)}
        />
        <TickerCell
          ind={ind}
          label={t('timeTracking.overtime', 'Overtime')}
          value={fmtHours(canViewOverview ? orgTotals.overtime : ownOvertime)}
          delta={canViewOverview && prevOvertime != null
            ? Math.abs(Math.round(orgTotals.overtime - prevOvertime)) || null
            : null}
          deltaDirection={canViewOverview && prevOvertime != null && orgTotals.overtime >= prevOvertime ? 'up' : 'down'}
        />
        <TickerCell
          ind={ind}
          label={t('timeTracking.leaveDays', 'Leave')}
          value={`${Math.round(canViewOverview ? orgTotals.leaveDays : calculatedLeaveDays)}d`}
        />
        {canViewOverview && attendance && (
          <TickerCell
            ind={ind}
            label={t('timeTracking.onTime', 'On time')}
            value={`${attendance.onTimeRate.toFixed(1)}%`}
            title={t('timeTracking.onTimeThisWeek', 'On-time arrivals this week')}
          />
        )}
        {canViewOverview && (
          <TickerCell
            ind={ind}
            label={t('timeTracking.missingPunch', 'Missing punch')}
            value={missingPunch.rows.length}
            // The one number on the strip that needs action.
            valueColor={missingPunch.rows.length > 0 ? ind.tickerUp : undefined}
            onClick={missingPunch.rows.length > 0 ? () => openException('missingPunch') : undefined}
            title={t('timeTracking.missingPunchOut', 'Missing punch-out')}
          />
        )}

        {/* Period picker — pushed right with flex:1 and a left hairline. */}
        <div
          style={{
            flex: 1,
            minWidth: 'max-content',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading || overviewLoading} isDarkMode label={t('common.fetching', 'Fetching')} />
          <FlatSelect
            ind={ind}
            onDark
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            aria-label={t('dashboard.currentMonth', 'Month')}
          >
            {monthNames.map((month, i) => (
              <option key={month} value={i + 1} style={{ color: '#1d1f20' }}>{month}</option>
            ))}
          </FlatSelect>
          <FlatSelect
            ind={ind}
            onDark
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label={t('common.year', 'Year')}
          >
            {years.map((y) => (
              <option key={y} value={y} style={{ color: '#1d1f20' }}>{y}</option>
            ))}
          </FlatSelect>
          <button
            type="button"
            onClick={() => { overviewCacheRef.current = { key: '', data: [] }; fetchTimeTrackingData(); fetchOrgSummaries(); fetchOrgEntries(); }}
            title={t('common.refresh', 'Refresh')}
            aria-label={t('common.refresh', 'Refresh')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, flex: 'none',
              border: `1px solid ${ind.tickerRule}`, borderRadius: 0,
              background: 'transparent', color: ind.tickerInk, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} strokeWidth={1.5} className={loading || overviewLoading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      {/* ── BANDS ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── MAIN ───────────────────────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{
            padding: 24,
            gap: 18,
            borderRight: canViewOverview ? `1px solid ${ind.hairline}` : 'none',
          }}
        >
          {/* Error banner */}
          {fetchError && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{fetchError}</p>
                <button
                  type="button"
                  onClick={() => { setFetchError(null); fetchTimeTrackingData(); }}
                  style={{
                    marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                  }}
                >
                  {t('common.retry', 'Try Again')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFetchError(null)}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* 3 — Page head */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, lineHeight: 1.05,
                  letterSpacing: '.02em', textTransform: 'uppercase', color: ind.ink, margin: 0,
                }}
              >
                {t('nav.timeTracking', 'Time Tracking')}
              </h1>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>
                {canViewOverview
                  ? `${employees.length} ${t('timeTracking.employeesLower', 'employees')}`
                  : selectedEmployeeName}
                {' · '}
                {workingDays} {t('timeTracking.workingDaysLower', 'working days')}
                {' · '}
                {t('timeTracking.contractLower', 'contract')} {CONTRACT_HOURS_PER_DAY}h/{t('timeTracking.dayShort', 'day')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {tabOptions.length > 1 && (
                <Seg
                  ind={ind}
                  options={tabOptions}
                  value={activeTab}
                  onChange={setActiveTab}
                  ariaLabel={t('timeTracking.view', 'View')}
                />
              )}
              <Btn ind={ind} onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={13} strokeWidth={1.5} />
                {t('common.export', 'Export')}
              </Btn>
            </div>
          </div>

          {/* 4 — Load against contract */}
          {activeTab === 'overview' && canViewOverview && (
            <Blueprint ind={ind} style={{ padding: '16px 20px 14px' }}>
              <div className="flex flex-wrap items-start justify-between" style={{ gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <Kicker ind={ind}>
                    {`${t('timeTracking.loadAgainstContract', 'Load against contract')} — ${contractHours}h ${t('timeTracking.monthLower', 'month')}`}
                  </Kicker>
                  <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                    {t('timeTracking.everyEmployee', 'Every employee, sorted by total hours. Dashed line is the contract.')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 14, flex: 'none' }}>
                  {[
                    { label: t('timeTracking.regularHours', 'Regular'), color: ind.accent },
                    { label: t('timeTracking.overtime', 'Overtime'), color: heavyInk },
                  ].map((entry) => (
                    <span key={entry.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span aria-hidden="true" style={{ width: 9, height: 9, background: entry.color, flex: 'none' }} />
                      <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{entry.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ height: 196, marginTop: 14 }}>
                {chartRows.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>
                    {overviewLoading ? t('common.loading', 'Loading…') : t('dashboard.noData', 'No data available')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="12%">
                      <XAxis dataKey="name" hide />
                      <YAxis hide domain={[0, (max) => Math.max(max, contractHours * 1.1)]} />
                      <Tooltip
                        cursor={{ fill: ind.hover }}
                        content={({ active, payload }) => (
                          <IndustryTooltip
                            ind={ind}
                            active={active}
                            payload={payload}
                            contractHours={contractHours}
                            labels={chartLabels}
                          />
                        )}
                      />
                      <RBar dataKey="regular" name={chartLabels.regular} stackId="load" fill={ind.accent} isAnimationActive={false} />
                      <RBar dataKey="overtime" name={chartLabels.overtime} stackId="load" fill={heavyInk} isAnimationActive={false} />
                      <ReferenceLine y={contractHours} stroke={ind.accent} strokeDasharray="4 3" strokeWidth={1} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 10 }}>
                {t('timeTracking.loadCaption', '{over} of {total} employees finished above the {contract}h contract; overtime is the segment stacked on top.')
                  .replace('{over}', String(overContractCount))
                  .replace('{total}', String(orgRows.length))
                  .replace('{contract}', String(contractHours))}
              </p>
            </Blueprint>
          )}

          {/* 5 — Timesheets */}
          {activeTab === 'overview' && canViewOverview && (
            <Blueprint ind={ind}>
              <div
                className="flex flex-wrap items-center justify-between"
                style={{ gap: 12, padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}
              >
                <Kicker ind={ind}>{`${t('timeTracking.timesheets', 'Timesheets')} · ${periodLabel}`}</Kicker>

                <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
                  {exceptionFilter && (
                    <button
                      type="button"
                      onClick={() => setExceptionFilter(null)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        border: `1px solid ${ind.ink}`, borderRadius: 0, background: 'transparent',
                        padding: '3px 8px', cursor: 'pointer',
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.1em',
                        textTransform: 'uppercase', color: ind.ink,
                      }}
                    >
                      {t(`timeTracking.filter.${exceptionFilter}`, exceptionFilter)}
                      <X size={11} strokeWidth={2} />
                    </button>
                  )}

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${ind.hairline}`, padding: '3px 8px' }}>
                    <Search size={13} strokeWidth={1.5} style={{ color: ind.inkMuted, flex: 'none' }} />
                    <input
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                      placeholder={t('common.filter', 'Filter')}
                      aria-label={t('common.filter', 'Filter')}
                      style={{
                        border: 'none', outline: 'none', background: 'transparent', color: ind.ink,
                        fontFamily: BODY, fontSize: 12.5, width: 110, padding: 0,
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowAllRows((v) => !v)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                      textTransform: 'uppercase', color: ind.accentDeep, whiteSpace: 'nowrap',
                    }}
                  >
                    {showAllRows
                      ? `${t('timeTracking.topTen', 'Top 10')} ←`
                      : `${t('common.all', 'All')} ${sortedRows.length} →`}
                  </button>
                </div>
              </div>

              <div style={{ padding: '10px 20px 16px' }}>
                <TableScroll>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={th('left', 'first')} onClick={() => handleSort('employee')} className="cursor-pointer select-none">
                          {t('timeTracking.employee', 'Employee')}{sortCaret('employee')}
                        </th>
                        <th style={th('left')} onClick={() => handleSort('department')} className={cn(COL.md, 'cursor-pointer select-none')}>
                          {t('employees.department', 'Department')}{sortCaret('department')}
                        </th>
                        <th style={th('right')} onClick={() => handleSort('days_worked')} className={cn(COL.md, 'cursor-pointer select-none')}>
                          {t('timeTracking.daysShort', 'Days')}{sortCaret('days_worked')}
                        </th>
                        <th style={th('right')} onClick={() => handleSort('regular_hours')} className={cn(COL.lg, 'cursor-pointer select-none')}>
                          {t('timeTracking.regularShort', 'Regular')}{sortCaret('regular_hours')}
                        </th>
                        <th style={th('right')} onClick={() => handleSort('overtime')} className={cn(COL.lg, 'cursor-pointer select-none')}>
                          {t('timeTracking.overtimeShort', 'Overtime')}{sortCaret('overtime')}
                        </th>
                        <th style={th('right')} onClick={() => handleSort('total_hours')} className="cursor-pointer select-none">
                          {t('timeTracking.totalShort', 'Total')}{sortCaret('total_hours')}
                        </th>
                        <th style={{ ...th('left', 'last'), width: 132, paddingLeft: 14 }} onClick={() => handleSort('load')} className="cursor-pointer select-none">
                          {t('timeTracking.load', 'Load')}{sortCaret('load')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '18px 0', color: ind.inkMuted }}>
                            {overviewLoading ? t('common.loading', 'Loading…') : t('timeTracking.noRecords', 'No records for this period')}
                          </td>
                        </tr>
                      )}
                      {visibleRows.map((row) => {
                        const loadPct = Math.round(row.load * 100);
                        // Three bands, read in this order: over the overtime cap
                        // is the loudest, then at/near contract, then under.
                        const fill = row.overtime > overtimeCap
                          ? heavyInk
                          : row.load >= 0.98 ? ind.accent : lightSteel;
                        const materialOvertime = row.overtime >= MATERIAL_OVERTIME_H;

                        return (
                          <tr key={row.id} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                            <td style={{ padding: '9px 8px 9px 0', color: ind.ink, minWidth: 0 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                              {/* Stand-ins for the columns this viewport has dropped */}
                              <StackedDetail showUntil="md" label={t('employees.department', 'Department')} value={row.departmentLabel} />
                              <StackedDetail showUntil="md" label={t('timeTracking.daysShort', 'Days')} value={row.days} />
                              <StackedDetail showUntil="lg" label={t('timeTracking.regularShort', 'Regular')} value={fmt1(row.regular)} />
                              <StackedDetail showUntil="lg" label={t('timeTracking.overtimeShort', 'Overtime')} value={fmt1(row.overtime)} />
                            </td>
                            <td className={COL.md} style={{ padding: '9px 8px', color: ind.inkMuted, whiteSpace: 'nowrap' }}>
                              {row.departmentLabel}
                            </td>
                            <td className={COL.md} style={{ padding: '9px 8px', textAlign: 'right', ...figure(13, ind.inkMuted) }}>
                              {row.days}
                            </td>
                            <td className={COL.lg} style={{ padding: '9px 8px', textAlign: 'right', ...figure(13, ind.inkMuted) }}>
                              {fmt1(row.regular)}
                            </td>
                            <td
                              className={COL.lg}
                              style={{
                                padding: '9px 8px',
                                textAlign: 'right',
                                ...figure(13, materialOvertime ? ind.ink : ind.inkMuted),
                                fontWeight: materialOvertime ? 700 : 600,
                              }}
                            >
                              {fmt1(row.overtime)}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', ...figure(14, ind.ink) }}>
                              {fmt1(row.total)}
                            </td>
                            <td style={{ padding: '9px 0 9px 14px', width: 132 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 40 }}>
                                  <Bar
                                    ind={ind}
                                    value={row.load * CONTRACT_TICK}
                                    fill={fill}
                                    marker={CONTRACT_TICK}
                                    height={9}
                                    title={`${fmt1(row.total)}h / ${contractHours}h`}
                                  />
                                </div>
                                <span style={{ ...figure(12.5, ind.ink), width: 30, textAlign: 'right', flex: 'none' }}>
                                  {loadPct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              </div>
            </Blueprint>
          )}

          {/* Summary — one employee, the period in full */}
          {activeTab === 'summary' && (
            <>
              <Blueprint ind={ind} style={{ padding: '16px 20px 18px' }}>
                <div className="flex flex-wrap items-center justify-between" style={{ gap: 12 }}>
                  <Kicker ind={ind}>{`${t('timeTracking.summary', 'Summary')} · ${periodLabel}`}</Kicker>
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <FlatSelect
                      ind={ind}
                      value={selectedEmployee || ''}
                      onChange={(e) => setSelectedEmployee(String(e.target.value))}
                      aria-label={t('timeTracking.employee', 'Employee')}
                    >
                      {employees.map((employee) => (
                        <option key={employee.id} value={String(employee.id)}>
                          {getDemoEmployeeName(employee, t)}
                        </option>
                      ))}
                    </FlatSelect>
                    <Btn ind={ind} variant="primary" onClick={() => setShowLeaveModal(true)}>
                      {t('timeTracking.requestLeave', 'Request Leave')}
                    </Btn>
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
                  style={{ gap: 18, marginTop: 18 }}
                >
                  {[
                    { label: t('timeTracking.regularHours', 'Regular Hours'), value: fmt1(currentData.regular_hours), unit: 'h' },
                    { label: t('timeTracking.overtimeHours', 'Overtime Hours'), value: fmt1(ownOvertime), unit: 'h' },
                    { label: t('timeTracking.totalHours', 'Total Hours'), value: fmt1(currentData.total_hours), unit: 'h' },
                    { label: t('timeTracking.workDays', 'Work Days'), value: currentData.days_worked || 0, unit: 'd' },
                    { label: t('timeTracking.leaveDays', 'Leave Days'), value: fmt1(calculatedLeaveDays), unit: 'd', note: t('timeTracking.includesPending', '*incl. pending') },
                    { label: t('timeTracking.load', 'Load'), value: contractHours > 0 ? Math.round(((currentData.total_hours || 0) / contractHours) * 100) : 0, unit: '%' },
                  ].map((item) => (
                    <div key={item.label} style={{ minWidth: 0 }}>
                      <Kicker ind={ind} color={ind.inkMuted}>{item.label}</Kicker>
                      <div style={{ ...figure(30, ind.ink), marginTop: 7 }}>
                        {item.value}
                        <span style={{ ...figure(15, ind.inkMuted), marginLeft: 2 }}>{item.unit}</span>
                      </div>
                      {item.note && (
                        <div style={{ fontFamily: BODY, fontSize: 11, color: ind.inkFaint, marginTop: 4 }}>{item.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Blueprint>

              <Blueprint ind={ind}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
                  <Kicker ind={ind}>{t('timeTracking.detailedBreakdown', 'Detailed Breakdown')}</Kicker>
                </div>
                <div style={{ padding: '10px 20px 16px' }}>
                  <TableScroll>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={th('left', 'first')}>{t('timeTracking.date', 'Date')}</th>
                          <th style={th('left')} className={COL.lg}>{t('timeTracking.employee', 'Employee')}</th>
                          <th style={th('left')} className={COL.md}>{t('timeTracking.time', 'Time')}</th>
                          <th style={th('left')}>{t('timeTracking.hourType', 'Hour Type')}</th>
                          <th style={th('right', 'last')}>{t('timeTracking.totalHours', 'Hours')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '18px 0', color: ind.inkMuted }}>
                              {t('timeTracking.noRecords', 'No attendance records found for this period')}
                            </td>
                          </tr>
                        )}
                        {attendanceRecords.map((record, index) => {
                          const hourType = record.hour_type || record.hourType || 'regular';
                          const range = LEAVE_TYPES.has(hourType)
                            ? '—'
                            : `${record.clock_in || record.clockIn || '—'} – ${record.clock_out || record.clockOut || '—'}`;

                          return (
                            <tr key={record.id || index} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                              <td style={{ padding: '9px 8px 9px 0', color: ind.ink, whiteSpace: 'nowrap' }}>
                                {record.date || (record.created_at ? new Date(record.created_at).toLocaleDateString() : '—')}
                                {/* Stand-ins for the columns this viewport has dropped */}
                                <StackedDetail showUntil="md" label={t('timeTracking.time', 'Time')} value={range} />
                                <StackedDetail showUntil="lg" label={t('timeTracking.employee', 'Employee')} value={selectedEmployeeName} />
                              </td>
                              <td className={COL.lg} style={{ padding: '9px 8px', color: ind.inkMuted }}>{selectedEmployeeName}</td>
                              <td className={COL.md} style={{ padding: '9px 8px', ...figure(13, ind.inkMuted) }}>{range}</td>
                              <td style={{ padding: '9px 8px' }}>
                                <Tag ind={ind} variant={OVERTIME_TYPES.has(hourType) ? 'outline' : 'neutral'}>
                                  {t(`timeTracking.${hourType}`, hourType)}
                                </Tag>
                              </td>
                              <td style={{ padding: '9px 0 9px 8px', textAlign: 'right', ...figure(14, ind.ink) }}>
                                {fmt1(record.hours)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} style={{ padding: '10px 8px 0 0', textAlign: 'right', fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, borderTop: `1px solid ${ind.hairline}` }}>
                            {`${attendanceRecords.length} ${t('timeTracking.days', 'days')} · ${t('timeTracking.totalHours', 'Total Hours')}`}
                          </td>
                          <td style={{ padding: '10px 0 0 8px', textAlign: 'right', ...figure(16, ind.ink), borderTop: `1px solid ${ind.hairline}` }}>
                            {fmt1(currentData.total_hours)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </TableScroll>
                </div>
              </Blueprint>
            </>
          )}

          {/* Leave requests */}
          {activeTab === 'leaveRequests' && canViewOverview && (
            <Blueprint ind={ind}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.hairline}` }}>
                <Kicker ind={ind}>{t('timeTracking.leaveRequestManagement', 'Leave Request Management')}</Kicker>
              </div>
              <div style={{ padding: '10px 20px 16px' }}>
                <TableScroll>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={th('left', 'first')} onClick={() => handleLeaveSort('requested_by')} className="cursor-pointer select-none">
                          {t('timeTracking.requestedBy', 'Requested By')}
                        </th>
                        <th style={th('left')} onClick={() => handleLeaveSort('leave_type')} className={cn(COL.md, 'cursor-pointer select-none')}>
                          {t('timeTracking.leaveType', 'Leave Type')}
                        </th>
                        <th style={th('left')} onClick={() => handleLeaveSort('start_date')} className={cn(COL.lg, 'cursor-pointer select-none')}>
                          {t('timeTracking.startDate', 'Start Date')}
                        </th>
                        <th style={th('right')} onClick={() => handleLeaveSort('days_count')} className="cursor-pointer select-none">
                          {t('timeTracking.leaveDays', 'Days')}
                        </th>
                        <th style={th('left')} onClick={() => handleLeaveSort('status')} className="cursor-pointer select-none">
                          {t('common.status', 'Status')}
                        </th>
                        <th style={th('right', 'last')}>{t('timeTracking.approvedBy', 'Approved By')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeaveRequests.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '18px 0', color: ind.inkMuted }}>
                            {t('leave.noRequests', 'No leave requests yet.')}
                          </td>
                        </tr>
                      )}
                      {sortedLeaveRequests.map((req, idx) => {
                        const leaveTypeLabel = t(`timeTracking.${req.leave_type === 'sick' ? 'sickLeave' : req.leave_type}`, req.leave_type || '—');
                        const busy = !!processingRequests[req.id];

                        return (
                          <tr key={req.id || idx} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                            <td style={{ padding: '9px 8px 9px 0', color: ind.ink, minWidth: 0 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {req.employee?.name || '—'}
                              </div>
                              {/* Stand-ins for the columns this viewport has dropped */}
                              <StackedDetail showUntil="md" label={t('timeTracking.leaveType', 'Leave Type')} value={leaveTypeLabel} />
                              <StackedDetail showUntil="lg" label={t('timeTracking.startDate', 'Start Date')} value={req.start_date} />
                            </td>
                            <td className={COL.md} style={{ padding: '9px 8px', color: ind.inkMuted }}>{leaveTypeLabel}</td>
                            <td className={COL.lg} style={{ padding: '9px 8px', ...figure(13, ind.inkMuted), whiteSpace: 'nowrap' }}>
                              {req.start_date} – {req.end_date}
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', ...figure(14, ind.ink) }}>{req.days_count}</td>
                            <td style={{ padding: '9px 8px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <Tag ind={ind} variant={req.status === 'pending' ? 'accent' : req.status === 'approved' ? 'neutral' : 'outline'}>
                                  {t(`timeTracking.requestStatus.${req.status}`, req.status)}
                                </Tag>
                                <MiniFlubberMorphingLeaveStatus isDarkMode={isDarkMode} status={req.status} size={16} />
                              </span>
                            </td>
                            <td style={{ padding: '9px 0 9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {req.status === 'pending' ? (
                                <span style={{ display: 'inline-flex', gap: 8 }}>
                                  <Btn ind={ind} variant="primary" disabled={busy} onClick={() => handleApproveRequest(req.id)}>
                                    {t('common.approve', 'Approve')}
                                  </Btn>
                                  <Btn ind={ind} disabled={busy} onClick={() => handleRejectRequest(req.id)}>
                                    {t('common.decline', 'Decline')}
                                  </Btn>
                                </span>
                              ) : (
                                <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                                  {req.approved_by_name || '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              </div>
            </Blueprint>
          )}
        </div>

        {/* ── EXCEPTIONS COLUMN — 340px fixed ────────────────────────── */}
        {canViewOverview && (
          <aside
            className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
            style={{ background: ind.chrome }}
          >
            {/* Header — the deadline is what makes this column time-bound */}
            <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${ind.hairline}` }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <ColumnHeading ind={ind}>{t('timeTracking.exceptions', 'Exceptions')}</ColumnHeading>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                  {exceptionCount} {t('dashboard.items', 'items')}
                </span>
              </div>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                {t('timeTracking.fixBeforePayroll', 'Fix before payroll closes')} {payrollCloseLabel}
              </p>
            </div>

            {/* Priority 1 — missing punch-out */}
            {missingPunch.people.length > 0 && (
              <div style={{ padding: '16px 20px', background: ind.accentWash, borderBottom: `1px solid ${ind.rule}` }}>
                <div className="flex items-start justify-between" style={{ gap: 10 }}>
                  <span style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.05em',
                    textTransform: 'uppercase', color: ind.ink,
                  }}>
                    {t('timeTracking.missingPunchOut', 'Missing punch-out')}
                  </span>
                  <Tag ind={ind}>
                    {missingPunch.people.length} {t('timeTracking.people', 'ppl')}
                  </Tag>
                </div>

                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                  {/* Name the third person rather than say "+1 others". */}
                  {missingPunch.people.slice(0, missingPunch.people.length === 3 ? 3 : 2).map((p) => p.name).join(', ')}
                  {missingPunch.people.length > 3 &&
                    ` +${missingPunch.people.length - 2} ${t('timeTracking.others', 'others')}`}
                  {missingPunch.firstDate && ` · ${fmtDayMonth(missingPunch.firstDate)}`}
                  {missingPunch.lastDate && missingPunch.lastDate !== missingPunch.firstDate &&
                    `–${fmtDayMonth(missingPunch.lastDate)}`}
                </p>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Btn ind={ind} variant="primary" disabled={closingPunches} onClick={handleAutoClose}>
                    {closingPunches
                      ? t('common.saving', 'Saving…')
                      : t('timeTracking.autoClose', 'Auto-close {time}').replace('{time}', shortTime(WORKDAY_END))}
                  </Btn>
                  <Btn ind={ind} onClick={() => openException('missingPunch')}>
                    {t('timeTracking.reviewEach', 'Review each')}
                  </Btn>
                </div>
              </div>
            )}

            {/* Priority 2 — over the overtime cap */}
            {overCapRows.length > 0 && (
              <div style={{ padding: '16px 20px', background: ind.accentWash, borderBottom: `1px solid ${ind.rule}` }}>
                <div className="flex items-start justify-between" style={{ gap: 10 }}>
                  <span style={{
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.05em',
                    textTransform: 'uppercase', color: ind.ink,
                  }}>
                    {t('timeTracking.overOvertimeCap', 'Over overtime cap')}
                  </span>
                  <Tag ind={ind}>
                    {overCapRows.length} {t('timeTracking.people', 'ppl')}
                  </Tag>
                </div>

                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 6 }}>
                  {t('timeTracking.aboveCap', 'Above {cap}h cap').replace('{cap}', String(overtimeCap))}
                  {' — '}
                  {overCapRows[0].departmentLabel}
                  {`, ${t('timeTracking.topIs', 'highest')} ${fmt1(overCapRows[0].overtime)}h`}
                </p>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Btn ind={ind} variant="primary" onClick={() => openException('overCap')}>
                    {t('timeTracking.openCases', 'Open cases')}
                  </Btn>
                  <Btn ind={ind} onClick={handleRaiseCap}>
                    {t('timeTracking.raiseCap', 'Raise cap')}
                  </Btn>
                </div>
              </div>
            )}

            {/* Compact rows — real, not yet urgent */}
            {unapprovedOvertime.rows.length > 0 && (
              <ExceptionRow
                ind={ind}
                active={exceptionFilter === 'unapprovedOvertime'}
                title={t('timeTracking.unapprovedOvertime', 'Unapproved overtime')}
                detail={t('timeTracking.acrossTimesheets', '{hours}h across {count} timesheets')
                  .replace('{hours}', fmt1(unapprovedOvertime.hours))
                  .replace('{count}', String(unapprovedOvertime.rows.length))}
                onClick={() => openException('unapprovedOvertime')}
              />
            )}

            {underContractRows.length > 0 && (
              <ExceptionRow
                ind={ind}
                active={exceptionFilter === 'underContract'}
                title={t('timeTracking.underContractHours', 'Under contract hours')}
                detail={`${underContractRows[0].name} · ${fmt1(underContractRows[0].total)}/${contractHours}h`}
                onClick={() => openException('underContract')}
              />
            )}

            {exceptionCount === 0 && (
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, padding: '18px 20px', borderBottom: `1px solid ${ind.rule}` }}>
                {t('timeTracking.noExceptions', 'Nothing is blocking payroll for this period.')}
              </p>
            )}

            {/* Attendance, this week */}
            {attendance && (
              <div style={{ padding: '18px 20px 22px' }}>
                <ColumnHeading ind={ind} style={{ fontSize: 13 }}>
                  {t('timeTracking.attendanceThisWeek', 'Attendance, this week')}
                </ColumnHeading>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: t('timeTracking.onTime', 'On time'), value: attendance.onTime },
                    { label: t('timeTracking.lateArrival', 'Late arrival'), value: attendance.late },
                    { label: t('timeTracking.absentUnreported', 'Absent, unreported'), value: attendance.absent },
                  ].map((row, i) => (
                    <AttendanceBar
                      key={row.label}
                      ind={ind}
                      label={row.label}
                      value={row.value}
                      share={employees.length > 0 ? row.value / employees.length : 0}
                      fill={rampAt(ind, i * 2)}
                    />
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 0,
            background: ind.accent, color: ind.accentInk,
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
          }}
        >
          <Check size={15} strokeWidth={2} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Leave request modal */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(29,31,32,.55)' }}
        >
          <div style={{ background: ind.ground, border: `1px solid ${ind.ink}`, borderRadius: 0, width: '100%', maxWidth: 440, padding: 24 }}>
            <div className="flex justify-between items-start" style={{ gap: 12 }}>
              <ColumnHeading ind={ind}>{t('timeTracking.requestLeave', 'Request Leave')}</ColumnHeading>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('timeTracking.leaveType', 'Leave Type')}</Kicker>
                <FlatSelect
                  ind={ind}
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  style={{ marginTop: 6, width: '100%', padding: '7px 8px' }}
                >
                  <option value="vacation">{t('timeTracking.vacation', 'Vacation')}</option>
                  <option value="sick">{t('timeTracking.sickLeave', 'Sick Leave')}</option>
                  <option value="personal">{t('timeTracking.personal', 'Personal Leave')}</option>
                  <option value="unpaid">{t('timeTracking.unpaid', 'Unpaid Leave')}</option>
                </FlatSelect>
              </div>

              <div className="grid grid-cols-2" style={{ gap: 14 }}>
                <div>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('timeTracking.startDate', 'Start Date')}</Kicker>
                  <DatePicker
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    required
                    inputClassName={`w-full px-3 py-2 border ${input.className}`}
                  />
                </div>
                <div>
                  <Kicker ind={ind} color={ind.inkMuted}>{t('timeTracking.endDate', 'End Date')}</Kicker>
                  <DatePicker
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    required
                    inputClassName={`w-full px-3 py-2 border ${input.className}`}
                  />
                </div>
              </div>

              <div>
                <Kicker ind={ind} color={ind.inkMuted}>{t('timeTracking.reason', 'Reason')}</Kicker>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows="3"
                  placeholder={t('timeTracking.reasonPlaceholder', 'Briefly explain your leave request...')}
                  style={{
                    marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 0,
                    border: `1px solid ${ind.hairline}`, background: 'transparent', color: ind.ink,
                    fontFamily: BODY, fontSize: 13, outline: 'none', resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Btn ind={ind} onClick={() => setShowLeaveModal(false)} style={{ flex: 1, padding: '8px 12px' }}>
                  {t('common.cancel', 'Cancel')}
                </Btn>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 0, cursor: 'pointer',
                    background: ind.accent, color: ind.accentInk, border: `1px solid ${ind.accent}`,
                    fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('common.leaveRequest', 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTracking;
