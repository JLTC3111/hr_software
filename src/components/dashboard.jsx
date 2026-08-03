/**
 * Organization Overview — direction 1b, "Control rail".
 *
 * Three vertical bands: the app rail (sidebar.jsx) → this main column → the
 * decision column. A 44px ticker spans main + decision and replaces metric
 * cards; per the spec the console never shows both.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through
 * weight and rule rather than colour.
 */
import _React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Heart, AlertCircle, TreePalm, Car, Salad, Clapperboard, Laptop, Form, PhoneCall,
  CupSoda, Flame, HouseWifi, HeartPlus, Coffee, AlarmClock, Gauge, BriefcaseBusiness,
  WifiPen, TrendingUp, LineChart, BatteryCharging, PersonStanding, Volleyball,
  DatabaseZap, RefreshCw, Users, User, Speech, ArrowRight, X,
} from 'lucide-react'
import MetricDetailModal from './metricDetailModal.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { useAuth } from '../contexts/AuthContext'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar as RBar } from 'recharts'
import * as timeTrackingService from '../services/timeTrackingService.js'
import { withTimeout } from '../utils/supabaseTimeout.js'
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts.js'
import { validateAndRefreshSession } from '../utils/sessionHelper.js'
import { retryWithBackoff, isRetryableError } from '../utils/retryHelper.js'
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js'
import { getDemoEmployeeName, isDemoMode } from '../utils/demoHelper.js'
import { filterInactiveEmployees } from '../utils/employeeStatus.js'
import { FlubberMorphIcon } from './ui/flubber-morph-icon.jsx'
import { FetchElapsedPill } from './ui/fetch-elapsed-pill'
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js'
import {
  Blueprint, Bar, Tag, Btn, Seg, Kicker, Delta, TickerCell, ColumnHeading,
  LiveClock, FlatSelect,
} from './ui/industry.jsx'

/* ------------------------------------------------------------------ *
 * Flubber morph icons.
 * Re-exported through components/index.jsx — keep all five exports.
 * ------------------------------------------------------------------ */

export const MiniFlubberAutoMorphEmployeesDashboard = (props) => (
  <FlubberMorphIcon icons={[Users, User, Speech, PersonStanding]} cacheKey="dash-employees" morphInterval={1000} morphDuration={500} {...props} />
);

export const MiniFlubberAutoMorphVacation = (props) => (
  <FlubberMorphIcon icons={[Coffee, Salad, Car, Volleyball, TreePalm, Clapperboard]} cacheKey="dash-vacation" morphInterval={1000} morphDuration={500} {...props} />
);

export const MiniFlubberAutoMorphOfficeWork = (props) => (
  <FlubberMorphIcon icons={[AlarmClock, Laptop, CupSoda, Form, PhoneCall]} cacheKey="dash-office" morphInterval={1000} morphDuration={500} {...props} />
);

export const MiniFlubberAutoMorphOverTime = (props) => (
  <FlubberMorphIcon icons={[Heart, HeartPlus, PersonStanding, HouseWifi, Flame]} cacheKey="dash-overtime" morphInterval={1000} morphDuration={500} {...props} />
);

export const MiniFlubberAutoMorphPerformance = (props) => (
  <FlubberMorphIcon icons={[LineChart, BriefcaseBusiness, Gauge, DatabaseZap, BatteryCharging, WifiPen, TrendingUp]} cacheKey="dash-performance" morphInterval={1000} morphDuration={500} {...props} />
);

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

/** Chart tooltip in the Industry idiom: hairline box, zero radius, no shadow colour. */
function IndustryTooltip({ ind, active, payload, label, title }) {
  if (!active || !payload?.length) return null;
  const seen = new Set();
  const rows = payload.filter((p) => {
    const key = String(p.dataKey || p.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <div style={{ background: ind.chrome, border: `1px solid ${ind.ink}`, borderRadius: 0, padding: '8px 10px', minWidth: 150 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted, marginBottom: 6 }}>
        {title || label}
      </div>
      {rows.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', marginTop: i === 0 ? 0 : 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, background: p.color || ind.accent, flex: 'none' }} />
            {p.name || p.dataKey}
          </span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Figure block: kicker + big number + caption. */
function FigureBlock({ ind, kicker: kickerText, value, caption, note, size = 62 }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Kicker ind={ind}>{kickerText}</Kicker>
      <div style={{ ...figure(size, ind.ink), marginTop: 8 }}>{value}</div>
      {caption && (
        <div style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 8 }}>{caption}</div>
      )}
      {note && <div style={{ marginTop: 5 }}>{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

const Dashboard = ({ employees, applications }) => {
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();

  const ind = getIndustry(isDarkMode);

  const [loading, setLoading] = useState(true);
  const [timeTrackingData, setTimeTrackingData] = useState({});
  const [allEmployeesData, setAllEmployeesData] = useState([]);
  const [leaveRequestsData, setLeaveRequestsData] = useState({});
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [decidingId, setDecidingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ type: '', data: [], title: '' });
  const [fetchError, setFetchError] = useState(null);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  /** 'all' or a department name — scopes the ticker, the figures and the queue. */
  const [scope, setScope] = useState('all');

  /** Real prior-period totals, used for the ticker deltas. Never blocks the page. */
  const [prevTotals, setPrevTotals] = useState(null);

  // ---------------------------------------------------------------- fetch

  const fetchDashboardData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (import.meta.env.DEV) console.log('📊 [Dashboard] fetchDashboardData called:', { employeeCount: employees.length, silent, isDemoMode: isDemoMode() });
    if (employees.length === 0) {
      console.warn('⚠️ [Dashboard] No employees to fetch data for');
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setFetchError(null); // Clear any previous errors
    }

    try {
      // Skip session validation in demo mode - demo data doesn't require authentication
      if (!isDemoMode()) {
        // Validate and refresh session if needed
        const sessionValidation = await validateAndRefreshSession();
        if (!sessionValidation.success) {
          throw new Error(sessionValidation.error);
        }
      }

      // Wrap the fetch logic with retry mechanism
      await retryWithBackoff(async () => {
        // Two batched calls cover the whole roster. This previously issued one
        // summary request plus one leave request *per employee* — 2N round trips,
        // so a 50-person company paid 100 requests on every dashboard load.
        const [overviewResult, leaveResult] = await withTimeout(
          Promise.all([
            timeTrackingService.getOverviewEmployeeSummaries(selectedMonth, selectedYear, employees),
            timeTrackingService.getAllLeaveRequests({
              year: selectedYear,
              includeEmployeeDetails: false,
            }),
          ]),
          DEFAULT_REQUEST_TIMEOUT
        );

        // Calculate leave days from leave_requests (pending + approved),
        // counted against the month the request starts in.
        const leaveData = {};
        employees.forEach(emp => { leaveData[String(emp.id)] = 0; });

        if (leaveResult.success && Array.isArray(leaveResult.data)) {
          leaveResult.data.forEach(req => {
            if (req.status === 'rejected') return;

            const empId = String(req.employee_id);
            if (!(empId in leaveData)) return; // outside the active roster

            const startDate = new Date(req.start_date);
            const reqMonth = startDate.getMonth() + 1;
            const reqYear = startDate.getFullYear();

            // Only count if within SELECTED month/year
            if (reqYear === selectedYear && reqMonth === selectedMonth) {
              leaveData[empId] += req.days_count || 0;
            }
          });
        }

        setLeaveRequestsData(leaveData);

        // Build timeTrackingData object - use string IDs for consistency with TEXT type
        const summaryByEmployeeId = new Map(
          (overviewResult.success ? overviewResult.data : []).map(
            item => [String(item.employee?.id), item.data]
          )
        );

        const trackingData = {};
        const employeesDataArray = [];
        employees.forEach(emp => {
          const empId = String(emp.id); // Ensure ID is string for TEXT type
          const data = summaryByEmployeeId.get(empId) || null;

          trackingData[empId] = data
            ? {
              workDays: data.days_worked || 0,
              leaveDays: Math.max(data.leave_days || 0, leaveData[empId] || 0), // Use max of service calculated (includes Time Entries) or requests
              overtime: data.overtime_hours || 0,
              holidayOvertime: data.holiday_overtime_hours || 0,
              regularHours: data.regular_hours || 0,
              totalHours: data.total_hours || 0,
              performance: emp.performance || 4.0
            }
            : {
              // Fallback to defaults if no data
              workDays: 0,
              leaveDays: leaveData[empId] || 0, // Use calculated leave days
              overtime: 0,
              holidayOvertime: 0,
              regularHours: 0,
              totalHours: 0,
              performance: emp.performance || 4.0
            };

          employeesDataArray.push({ employee: emp, data });
        });

        setAllEmployeesData(employeesDataArray);
        setTimeTrackingData(trackingData);

        // Fetch pending approvals count and details together
        const [approvalsResult, approvalsDetailResult] = await Promise.all([
          timeTrackingService.getPendingApprovalsCount(),
          timeTrackingService.getPendingApprovals(),
        ]);

        if (approvalsResult.success) {
          setPendingApprovalsCount(approvalsResult.data.total || 0);
        } else {
          console.warn('Failed to fetch pending approvals count:', approvalsResult.error);
          setPendingApprovalsCount(0);
        }

        if (approvalsDetailResult.success) {
          setPendingApprovals(approvalsDetailResult.data || []);
        } else {
          console.warn('Failed to fetch pending approvals details:', approvalsDetailResult.error);
          setPendingApprovals([]);
        }
      }, {
        maxRetries: 2,
        shouldRetry: isRetryableError,
        onRetry: (_error, attempt, delay) => {
          console.log(`🔄 Dashboard: Retrying fetch (${attempt}/2) after ${delay}ms...`);
        }
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);

      if (handleSessionAuthError(error, { setFetchError })) {
        return;
      }

      // Set user-visible error message for other errors
      setFetchError(error.message || 'Failed to load dashboard data. Please try refreshing the page.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [employees, selectedMonth, selectedYear, handleSessionAuthError]);

  // Memoize the silent refresh callback
  const silentRefresh = useCallback(() => {
    fetchDashboardData({ silent: true });
  }, [fetchDashboardData]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (employees.length > 0) {
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useAuthenticatedPageRefresh(silentRefresh);

  /**
   * Prior period, fetched separately so the ticker deltas are real numbers
   * rather than decoration. Deliberately non-blocking: any failure just means
   * the deltas stay hidden, and nothing about the main load path changes.
   */
  useEffect(() => {
    if (employees.length === 0) return undefined;
    let cancelled = false;

    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

    (async () => {
      try {
        const result = await timeTrackingService.getOverviewEmployeeSummaries(prevMonth, prevYear, employees);
        if (cancelled || !result?.success) return;
        const rows = (result.data || []).map((item) => item.data).filter(Boolean);
        if (rows.length === 0) { setPrevTotals(null); return; }
        setPrevTotals({
          regularHours: rows.reduce((s, d) => s + (d.regular_hours || 0), 0),
          overtime: rows.reduce((s, d) => s + (d.overtime_hours || 0) + (d.holiday_overtime_hours || 0), 0),
          leaveDays: rows.reduce((s, d) => s + (d.leave_days || 0), 0),
          workDays: rows.reduce((s, d) => s + (d.days_worked || 0), 0),
        });
      } catch {
        if (!cancelled) setPrevTotals(null); // deltas are optional
      }
    })();

    return () => { cancelled = true; };
  }, [employees, selectedMonth, selectedYear]);

  // ---------------------------------------------------------------- scope

  const departmentCountsAll = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const key = emp.department || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [employees]);

  /** Company + the three largest departments — the spec's [Company|Eng|Sales|Office]. */
  const scopeOptions = useMemo(() => {
    const top = Object.entries(departmentCountsAll)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([dept]) => ({ value: dept, label: t(`employeeDepartment.${dept}`, dept) }));
    return [{ value: 'all', label: t('dashboard.company', 'Company') }, ...top];
  }, [departmentCountsAll, t]);

  // A department can disappear from the roster while it is selected.
  useEffect(() => {
    if (scope !== 'all' && !scopeOptions.some((o) => o.value === scope)) setScope('all');
  }, [scope, scopeOptions]);

  const scopedEmployees = useMemo(
    () => (scope === 'all' ? employees : employees.filter((e) => (e.department || 'Unassigned') === scope)),
    [employees, scope]
  );

  const scopedIds = useMemo(() => new Set(scopedEmployees.map((e) => String(e.id))), [scopedEmployees]);

  // ---------------------------------------------------------------- totals

  const trackingDataValues = useMemo(
    () => scopedEmployees.map((e) => timeTrackingData[String(e.id)]).filter(Boolean),
    [scopedEmployees, timeTrackingData]
  );

  const totalWorkDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.workDays || 0), 0);
  const totalLeaveDays = trackingDataValues.reduce((sum, emp) => sum + (emp?.leaveDays || 0), 0);
  const totalOvertime = trackingDataValues.reduce((sum, emp) => sum + (emp?.overtime || 0) + (emp?.holidayOvertime || 0), 0).toFixed(1);
  const totalRegularHours = trackingDataValues.reduce((sum, emp) => sum + (emp?.regularHours || 0), 0).toFixed(0);
  const avgPerformance = trackingDataValues.length > 0
    ? (trackingDataValues.reduce((sum, emp) => sum + (emp?.performance || 0), 0) / trackingDataValues.length).toFixed(1)
    : '0.0';

  /**
   * Share of the scoped roster that is no longer active.
   *
   * This is a standing share, not a rate over the selected period: `employees`
   * records a status but no termination date, so there is no way to ask who
   * left *this month*. Labelled "Attrition" per the spec, with the tooltip
   * spelling out what is actually being counted.
   */
  const attrition = useMemo(() => {
    if (scopedEmployees.length === 0) return { pct: '0%', inactive: 0 };
    const inactive = filterInactiveEmployees(scopedEmployees).length;
    return {
      pct: `${Math.round((inactive / scopedEmployees.length) * 100)}%`,
      inactive,
    };
  }, [scopedEmployees]);

  // Check if we have any real data
  const hasRealData = trackingDataValues.some(emp => emp?.workDays > 0 || emp?.overtime > 0);

  /** Deltas only appear when the prior period actually returned rows. */
  const deltas = useMemo(() => {
    if (!prevTotals || scope !== 'all') return {};
    const mk = (curr, prev, digits = 0) => {
      const diff = curr - prev;
      if (!Number.isFinite(diff) || Math.abs(diff) < (digits ? 0.05 : 0.5)) return null;
      return { value: Math.abs(diff).toFixed(digits), direction: diff > 0 ? 'up' : 'down' };
    };
    return {
      regularHours: mk(Number(totalRegularHours), prevTotals.regularHours),
      overtime: mk(Number(totalOvertime), prevTotals.overtime, 1),
      leaveDays: mk(totalLeaveDays, prevTotals.leaveDays),
      workDays: mk(totalWorkDays, prevTotals.workDays),
    };
  }, [prevTotals, scope, totalRegularHours, totalOvertime, totalLeaveDays, totalWorkDays]);

  // Helper function to generate display names for charts - always use last name
  const getUniqueDisplayName = useCallback((employee) => {
    const translatedName = getDemoEmployeeName(employee, t);
    const nameParts = translatedName.trim().split(/\s+/).filter(part => part.length > 0);
    if (nameParts.length === 0) return `Employee #${employee.id}`;

    // Always use last name for cleaner, more compact display
    return nameParts[nameParts.length - 1];
  }, [t]);

  // ---------------------------------------------------------------- series

  // Performance data for the hero area chart
  const performanceData = useMemo(() => scopedEmployees.map(emp => ({
    name: getUniqueDisplayName(emp),
    fullName: getDemoEmployeeName(emp, t), // Keep full name for tooltip
    id: emp.id,
    performance: timeTrackingData[String(emp.id)]?.performance || 4.0,
    overtime: timeTrackingData[String(emp.id)]?.overtime || 0,
  })), [scopedEmployees, timeTrackingData, getUniqueDisplayName, t]);

  const performanceScores = performanceData.map((d) => d.performance);
  const performanceHigh = performanceScores.length ? Math.max(...performanceScores).toFixed(1) : '—';
  const performanceLow = performanceScores.length ? Math.min(...performanceScores).toFixed(1) : '—';

  // Headcount by department (always company-wide — the roster does not change with scope)
  const departmentRows = useMemo(() => {
    const total = employees.length || 1;
    return Object.entries(departmentCountsAll)
      .map(([dept, count]) => ({
        dept,
        label: t(`employeeDepartment.${dept}`, dept),
        count,
        share: count / total,
      }))
      .sort((a, b) => b.count - a.count);
  }, [departmentCountsAll, employees.length, t]);

  const departmentTotal = departmentRows.reduce((s, r) => s + r.count, 0);

  // Hours logged — regular + overtime, ranked
  const hoursRows = useMemo(() => allEmployeesData
    .filter((item) => item.data && scopedIds.has(String(item.employee?.id)))
    .map((item) => ({
      id: item.employee.id,
      name: getUniqueDisplayName(item.employee),
      fullName: getDemoEmployeeName(item.employee, t) || item.employee.name,
      regularHours: item.data?.regular_hours || 0,
      overtimeHours: (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0),
    }))
    .sort((a, b) => (b.regularHours + b.overtimeHours) - (a.regularHours + a.overtimeHours))
    .slice(0, 8), [allEmployeesData, scopedIds, getUniqueDisplayName, t]);

  const hoursRegularTotal = hoursRows.reduce((sum, row) => sum + (row.regularHours || 0), 0);
  const hoursOvertimeTotal = hoursRows.reduce((sum, row) => sum + (row.overtimeHours || 0), 0);
  const hoursMaxTotal = Math.max(1, ...hoursRows.map((row) => (row.regularHours || 0) + (row.overtimeHours || 0)));

  // Work vs leave days
  const leaveData = useMemo(() => scopedEmployees.map(emp => {
    const empId = String(emp.id);
    return {
      name: getUniqueDisplayName(emp),
      fullName: getDemoEmployeeName(emp, t), // Keep full name for tooltip
      id: emp.id,
      leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
      workDays: timeTrackingData[empId]?.workDays || 0,
    };
  }), [scopedEmployees, leaveRequestsData, timeTrackingData, getUniqueDisplayName, t]);

  const leaveChartWorkTotal = leaveData.reduce((sum, row) => sum + (row.workDays || 0), 0);
  const leaveChartLeaveTotal = leaveData.reduce((sum, row) => sum + (row.leaveDays || 0), 0);

  // Top performers
  const topPerformers = useMemo(() => scopedEmployees
    .map(emp => ({
      ...emp,
      performance: timeTrackingData[String(emp.id)]?.performance || 4.0,
      overtime: timeTrackingData[String(emp.id)]?.overtime || 0,
    }))
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5), [scopedEmployees, timeTrackingData]);

  // ---------------------------------------------------------------- queue

  /** Pending time entries, scoped and oldest first — the decision column's spine. */
  const decisionQueue = useMemo(() => {
    const rows = pendingApprovals.filter((a) => {
      const empId = String(a.employee?.id ?? a.employee_id ?? '');
      return scope === 'all' || scopedIds.has(empId);
    });
    return rows
      .map((a) => {
        const when = a.date || a.created_at || null;
        const waitedDays = when
          ? Math.max(0, Math.floor((Date.now() - new Date(when).getTime()) / 86400000))
          : 0;
        return { ...a, _when: when, _waitedDays: waitedDays };
      })
      .sort((a, b) => b._waitedDays - a._waitedDays);
  }, [pendingApprovals, scope, scopedIds]);

  const oldestWaited = decisionQueue.length ? decisionQueue[0]._waitedDays : 0;
  const overdueCount = decisionQueue.filter((r) => r._waitedDays >= 2).length;

  /** Hiring pipeline, read off the applications already loaded by App.jsx. */
  const pipeline = useMemo(() => {
    const norm = (s) => String(s || '').trim().toLowerCase();
    const count = (...names) => applications.filter((a) => names.includes(norm(a.status)) || names.includes(norm(a.stage))).length;
    return [
      { key: 'screening', label: t('dashboard.pipeline.screening', 'Screening'), value: count('under review', 'screening', 'applied', 'new') },
      { key: 'shortlisted', label: t('dashboard.pipeline.shortlisted', 'Shortlisted'), value: count('shortlisted') },
      { key: 'interview', label: t('dashboard.pipeline.interview', 'Interview'), value: count('interview scheduled', 'interview') },
      { key: 'offer', label: t('dashboard.pipeline.offer', 'Offer'), value: count('offer extended', 'offer') },
    ];
  }, [applications, t]);

  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.value));

  // ---------------------------------------------------------------- actions

  /** Approve / decline straight from the queue, same service the time clock uses. */
  const handleDecision = useCallback(async (entry, status) => {
    setDecidingId(entry.id);
    try {
      const approverId = user?.employee_id || user?.employeeId || user?.id;
      const result = await timeTrackingService.updateTimeEntryStatus(entry.id, status, approverId);
      if (result.success) {
        setPendingApprovals((prev) => prev.filter((a) => a.id !== entry.id));
        setPendingApprovalsCount((n) => Math.max(0, n - 1));
        // Pull fresh totals so the hours/overtime figures agree with the queue.
        fetchDashboardData({ silent: true });
      } else {
        setFetchError(result.error || t('timeClock.approvalError', 'Failed to update entry'));
      }
    } catch (error) {
      console.error('Error updating approval:', error);
      if (handleSessionAuthError(error, { setFetchError })) return;
      setFetchError(error.message || t('timeClock.approvalError', 'Failed to update entry'));
    } finally {
      setDecidingId(null);
    }
  }, [user, fetchDashboardData, handleSessionAuthError, t]);

  // Handle metric click - prepare data and open modal
  const handleMetricClick = (metricType) => {
    const roster = scopedEmployees;
    let data = [];
    let title = '';

    switch (metricType) {
      case 'employees':
        data = roster.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          department: emp.department,
          position: emp.position,
          status: emp.status
        }));
        title = t('dashboard.totalEmployees');
        break;

      case 'performance':
        data = roster.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          performance: timeTrackingData[String(emp.id)]?.performance || emp.performance || 0,
          overtime: timeTrackingData[String(emp.id)]?.overtime || 0
        }));
        title = t('dashboard.avgPerformance');
        break;

      case 'regularHours':
        data = roster.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          regularHours: timeTrackingData[String(emp.id)]?.regularHours || 0,
          totalHours: timeTrackingData[String(emp.id)]?.totalHours || 0
        }));
        title = t('dashboard.totalRegularHours', '');
        break;

      case 'overtime':
        data = roster.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          overtime: (timeTrackingData[String(emp.id)]?.overtime || 0) + (timeTrackingData[String(emp.id)]?.holidayOvertime || 0),
          workDays: timeTrackingData[String(emp.id)]?.workDays || 0
        }));
        title = t('dashboard.totalOvertime');
        break;

      case 'leave':
        data = roster.map(emp => {
          const empId = String(emp.id);
          return {
            employeeName: getDemoEmployeeName(emp, t),
            position: emp.position,
            department: emp.department,
            leaveDays: leaveRequestsData[empId] || timeTrackingData[empId]?.leaveDays || 0,
            workDays: timeTrackingData[empId]?.workDays || 0
          };
        });
        title = t('dashboard.totalLeave');
        break;

      case 'workDays':
        data = roster.map(emp => ({
          employeeName: getDemoEmployeeName(emp, t),
          position: emp.position,
          department: emp.department,
          workDays: timeTrackingData[String(emp.id)]?.workDays || 0,
          overtime: timeTrackingData[String(emp.id)]?.overtime || 0
        }));
        title = t('dashboard.totalWorkDays');
        break;

      case 'pendingRequests':
        data = decisionQueue.map(approval => ({
          employeeName: approval.employee?.name || approval.employeeName || 'Unknown Employee',
          department: approval.employee?.department || approval.department || 'N/A',
          requestType: approval.hour_type || approval.requestType || 'Time Entry',
          date: approval.date || approval.created_at || new Date().toISOString(),
          status: approval.status || 'pending',
          hours: approval.hours || 0
        }));
        title = t('dashboard.pendingRequests', 'Pending Requests');
        break;

      case 'applications':
        data = applications;
        title = t('dashboard.activeApplications');
        break;

      default:
        return;
    }

    setModalConfig({ type: metricType, data, title });
    setModalOpen(true);
  };

  // ---------------------------------------------------------------- render

  const monthNames = [
    ['january', 'January'], ['february', 'February'], ['march', 'March'], ['april', 'April'],
    ['may', 'May'], ['june', 'June'], ['july', 'July'], ['august', 'August'],
    ['september', 'September'], ['october', 'October'], ['november', 'November'], ['december', 'December'],
  ];
  const periodLabel = `${t(`months.${monthNames[selectedMonth - 1][0]}`, monthNames[selectedMonth - 1][1])} ${selectedYear}`;
  const scopeLabel = scopeOptions.find((o) => o.value === scope)?.label ?? '';

  const axisTick = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', fill: ind.inkMuted,
  };

  const sectionRule = { borderTop: `1px solid ${ind.rule}` };

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

        {/*
          `dashboard.workforce` is defined as "Workforce" in en.js, so the
          fallback here never showed; the strip read WORKFORCE. Its own key.
        */}
        <TickerCell
          ind={ind}
          label={t('dashboard.headcount', 'Headcount')}
          value={scopedEmployees.length}
          onClick={() => handleMetricClick('employees')}
          title={t('dashboard.totalEmployees')}
        />
        <TickerCell
          ind={ind}
          label={t('dashboard.attrition', 'Attrition')}
          value={attrition.pct}
          onClick={() => handleMetricClick('employees')}
          title={t(
            'dashboard.attritionHint',
            'Share of this roster marked inactive. Employees carry no termination date, so this is a standing share rather than a rate for the selected period.'
          )}
        />
        <TickerCell
          ind={ind}
          label={t('dashboard.hours', 'Hours')}
          value={Number(totalRegularHours).toLocaleString()}
          delta={deltas.regularHours?.value}
          deltaDirection={deltas.regularHours?.direction}
          onClick={() => handleMetricClick('regularHours')}
          title={t('dashboard.totalRegularHours', 'Total Regular Hours')}
        />
        <TickerCell
          ind={ind}
          label={t('dashboard.performance', 'Perf')}
          value={avgPerformance}
          onClick={() => handleMetricClick('performance')}
          title={t('dashboard.avgPerformance')}
        />
        <TickerCell
          ind={ind}
          label={t('dashboard.overtime', 'Overtime')}
          value={`${totalOvertime}h`}
          delta={deltas.overtime?.value}
          deltaDirection={deltas.overtime?.direction}
          onClick={() => handleMetricClick('overtime')}
          title={t('dashboard.totalOvertime')}
        />
        <TickerCell
          ind={ind}
          label={t('dashboard.leave', 'Leave')}
          value={totalLeaveDays}
          delta={deltas.leaveDays?.value}
          deltaDirection={deltas.leaveDays?.direction}
          onClick={() => handleMetricClick('leave')}
          title={t('dashboard.totalLeave')}
        />

        {/* Period selector — pushed right with flex:1 and a left hairline. */}
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
          <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
          <FlatSelect
            ind={ind}
            onDark
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            aria-label={t('dashboard.currentMonth', 'Month')}
          >
            {monthNames.map(([key, fallback], i) => (
              <option key={key} value={i + 1} style={{ color: '#1d1f20' }}>
                {t(`months.${key}`, fallback)}
              </option>
            ))}
          </FlatSelect>
          <FlatSelect
            ind={ind}
            onDark
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="Year"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y} style={{ color: '#1d1f20' }}>{y}</option>
            ))}
          </FlatSelect>
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            title={t('common.refresh', 'Refresh')}
            aria-label={t('common.refresh', 'Refresh')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, flex: 'none',
              border: `1px solid ${ind.tickerRule}`, borderRadius: 0,
              background: 'transparent', color: ind.tickerInk, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      {/* ── BANDS ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── MAIN — the only band that scrolls ──────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: 24, gap: 18, borderRight: `1px solid ${ind.hairline}` }}
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
                  onClick={() => { setFetchError(null); fetchDashboardData(); }}
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

          {/* 1 — Title row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 34, lineHeight: 1.05,
                  letterSpacing: '.02em', textTransform: 'uppercase', color: ind.ink, margin: 0,
                }}
              >
                {t('dashboard.overview', 'Organization Overview')}
              </h1>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>
                {scope === 'all' ? periodLabel : `${scopeLabel} · ${periodLabel}`}
                {' · '}
                {hasRealData
                  ? t('dashboard.liveData', 'Live data from Supabase')
                  : t('dashboard.noData', 'No time tracking data yet')}
              </p>
            </div>
            <Seg
              ind={ind}
              options={scopeOptions}
              value={scope}
              onChange={setScope}
              ariaLabel={t('employees.department', 'Department')}
            />
          </div>

          {/* 2 — Hero figure */}
          <Blueprint ind={ind} style={{ padding: '18px 20px 12px' }}>
            <div className="flex flex-col md:flex-row gap-5 md:gap-8">
              <div style={{ flex: 'none', width: 190 }}>
                <FigureBlock
                  ind={ind}
                  kicker={t('dashboard.avgPerformance', 'Average Performance')}
                  value={avgPerformance}
                  caption={`${t('dashboard.outOf', 'of')} 5.0 · ${performanceData.length} ${t('dashboard.reviews', 'reviews')}`}
                  note={
                    // Labelled explicitly: these are the roster's spread, not a
                    // period-over-period change. Only the ticker carries deltas.
                    performanceScores.length > 0 && (
                      <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                        <Delta ind={ind} direction="up">{`${t('dashboard.high', 'High')} ${performanceHigh}`}</Delta>
                        <Delta ind={ind} direction="down">{`${t('dashboard.low', 'Low')} ${performanceLow}`}</Delta>
                      </span>
                    )
                  }
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, height: 176 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 6, right: 4, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="ind-perf-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ind.accent} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={ind.accent} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={ind.rule} strokeDasharray="0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} interval="preserveStartEnd" height={20} tick={axisTick} />
                    <YAxis hide domain={[0, 5]} />
                    <Tooltip
                      cursor={{ stroke: ind.hairline, strokeWidth: 1 }}
                      content={({ active, payload, label }) => (
                        <IndustryTooltip
                          ind={ind}
                          active={active}
                          payload={payload}
                          label={label}
                          title={payload?.[0]?.payload?.fullName
                            ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`
                            : label}
                        />
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="performance"
                      name={t('dashboard.performanceRating', 'Performance Rating')}
                      stroke={ind.accent}
                      strokeWidth={2}
                      fill="url(#ind-perf-fill)"
                      dot={false}
                      activeDot={{ r: 3, fill: ind.accent, stroke: ind.ground, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Blueprint>

          {/* 3 — Two figures side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 18 }}>

            {/* Headcount by department */}
            <Blueprint ind={ind} style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-baseline justify-between gap-3">
                <Kicker ind={ind}>{t('dashboard.departmentDist', 'Headcount by Dept')}</Kicker>
                <button
                  type="button"
                  onClick={() => handleMetricClick('employees')}
                  style={{ ...figure(20, ind.ink), background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  title={t('dashboard.totalEmployees')}
                >
                  {departmentTotal}
                </button>
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {departmentRows.length === 0 && (
                  <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>{t('dashboard.noData', 'No data available')}</p>
                )}
                {departmentRows.map((row, i) => {
                  const selectable = scopeOptions.some((o) => o.value === row.dept);
                  return (
                    <button
                      key={row.dept}
                      type="button"
                      onClick={() => selectable && setScope(scope === row.dept ? 'all' : row.dept)}
                      disabled={!selectable}
                      title={selectable ? t('dashboard.filterByDept', 'Filter by department') : row.label}
                      style={{
                        background: 'none', border: 'none', padding: 0, textAlign: 'left',
                        cursor: selectable ? 'pointer' : 'default', width: '100%',
                      }}
                    >
                      <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 4 }}>
                        <span style={{
                          fontFamily: BODY, fontSize: 13,
                          color: scope === row.dept ? ind.ink : ind.inkGhost,
                          fontWeight: scope === row.dept ? 600 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row.label}
                        </span>
                        <span style={{ ...figure(14, ind.ink), flex: 'none' }}>{row.count}</span>
                      </div>
                      <Bar ind={ind} value={row.share} fill={rampAt(ind, i)} />
                    </button>
                  );
                })}
              </div>
            </Blueprint>

            {/* Hours logged */}
            <Blueprint ind={ind} style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-baseline justify-between gap-3">
                <Kicker ind={ind}>{t('dashboard.regularAndOvertimeByEmployee', 'Hours Logged')}</Kicker>
                <button
                  type="button"
                  onClick={() => handleMetricClick('regularHours')}
                  style={{ ...figure(20, ind.ink), background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  title={t('dashboard.totalRegularHours', 'Total Regular Hours')}
                >
                  {Math.round(hoursRegularTotal + hoursOvertimeTotal)}h
                </button>
              </div>

              {/* Legend — regular is the accent, overtime the deep tone. */}
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                {[
                  { label: t('dashboard.regularHoursLegend', 'Regular'), color: ind.accent, value: `${Math.round(hoursRegularTotal)}h` },
                  { label: t('dashboard.totalOvertimeLegend', 'Overtime'), color: ind.accentDeeper, value: `${hoursOvertimeTotal.toFixed(1)}h` },
                ].map((l) => (
                  <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, background: l.color, flex: 'none' }} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
                      {l.label}
                    </span>
                    <span style={{ ...figure(12, ind.ink) }}>{l.value}</span>
                  </span>
                ))}
              </div>

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hoursRows.length === 0 && (
                  <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>
                    {t('dashboard.noData', 'No time tracking data yet')}
                  </p>
                )}
                {hoursRows.map((row) => {
                  const regular = Number(row.regularHours) || 0;
                  const overtime = Number(row.overtimeHours) || 0;
                  const total = regular + overtime;
                  const fmtH = (n) => n.toFixed(n % 1 ? 1 : 0);
                  return (
                    <div key={row.id}>
                      <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: BODY, fontSize: 13, color: ind.inkGhost, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.fullName || row.name}
                        </span>
                        <span style={{ ...figure(14, ind.ink), flex: 'none' }}>
                          {fmtH(total)}h
                          {overtime > 0 && (
                            <span style={{ fontSize: 11, color: ind.inkMuted, marginLeft: 6 }}>
                              +{fmtH(overtime)} OT
                            </span>
                          )}
                        </span>
                      </div>
                      {/* One hairline box, two fills: regular then overtime. */}
                      <div
                        title={`${row.fullName || row.name} — ${fmtH(regular)}h + ${fmtH(overtime)}h OT`}
                        style={{ position: 'relative', height: 8, border: `1px solid ${ind.hairline}`, display: 'flex' }}
                      >
                        <div style={{ width: `${(regular / hoursMaxTotal) * 100}%`, height: '100%', background: ind.accent, transition: 'width .45s ease' }} />
                        <div style={{ width: `${(overtime / hoursMaxTotal) * 100}%`, height: '100%', background: ind.accentDeeper, transition: 'width .45s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Blueprint>
          </div>

          {/* 4 — Work vs leave, and the ranked roster table */}
          <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 18 }}>

            {/* Work vs leave days */}
            <Blueprint ind={ind} style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-baseline justify-between gap-3">
                <Kicker ind={ind}>{t('dashboard.workLeaveComp', 'Work vs Leave Days')}</Kicker>
                <button
                  type="button"
                  onClick={() => handleMetricClick('workDays')}
                  style={{ ...figure(20, ind.ink), background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  title={t('dashboard.totalWorkDays')}
                >
                  {leaveChartWorkTotal + leaveChartLeaveTotal}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                {[
                  { label: t('dashboard.totalWorkDays', 'Work Days'), color: ind.accent, value: leaveChartWorkTotal },
                  { label: t('dashboard.totalLeave', 'Leave'), color: ind.ramp[3], value: leaveChartLeaveTotal },
                ].map((l) => (
                  <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, background: l.color, flex: 'none' }} />
                    <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
                      {l.label}
                    </span>
                    <span style={{ ...figure(12, ind.ink) }}>{l.value}</span>
                  </span>
                ))}
              </div>
              <div style={{ height: 208, marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaveData} margin={{ top: 4, right: 4, left: -14, bottom: 4 }} barCategoryGap="30%" barGap={2}>
                    <CartesianGrid vertical={false} stroke={ind.rule} strokeDasharray="0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} interval="preserveStartEnd" height={20} tick={axisTick} />
                    <YAxis axisLine={false} tickLine={false} tick={axisTick} width={34} />
                    <Tooltip
                      cursor={{ fill: ind.hover }}
                      content={({ active, payload, label }) => (
                        <IndustryTooltip
                          ind={ind}
                          active={active}
                          payload={payload}
                          label={label}
                          title={payload?.[0]?.payload?.fullName
                            ? `${t('dashboard.employeeLabel', 'Employee')}: ${payload[0].payload.fullName}`
                            : label}
                        />
                      )}
                    />
                    <RBar dataKey="workDays" name={t('dashboard.totalWorkDays', 'Total Work Days')} fill={ind.accent} maxBarSize={16} />
                    <RBar dataKey="leaveDays" name={t('dashboard.totalLeave', 'Total Leave')} fill={ind.ramp[3]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Blueprint>

            {/* Top performers — table idiom: numeric right-aligned, last column an inline bar */}
            <Blueprint ind={ind} style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-baseline justify-between gap-3">
                <Kicker ind={ind}>{t('dashboard.topPerformers', 'Top Performers')}</Kicker>
                <button
                  type="button"
                  onClick={() => handleMetricClick('performance')}
                  style={{ ...figure(20, ind.ink), background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  title={t('dashboard.avgPerformance')}
                >
                  {topPerformers[0]?.performance?.toFixed?.(1) ?? '—'}
                </button>
              </div>

              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 }}>
                  <thead>
                    <tr>
                      {[
                        { k: 'rank', label: '#', align: 'left', w: 26 },
                        { k: 'name', label: t('employees.name', 'Employee'), align: 'left' },
                        { k: 'ot', label: t('dashboard.overtime', 'OT'), align: 'right' },
                        { k: 'score', label: t('dashboard.performanceRating', 'Rating'), align: 'right' },
                        { k: 'bar', label: '', align: 'left', w: 84 },
                      ].map((c) => (
                        <th
                          key={c.k}
                          style={{
                            textAlign: c.align, width: c.w, padding: '0 0 7px',
                            borderBottom: `1px solid ${ind.hairline}`,
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10,
                            letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topPerformers.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '14px 0', color: ind.inkMuted }}>
                          {t('dashboard.noData', 'No data available')}
                        </td>
                      </tr>
                    )}
                    {topPerformers.map((emp, index) => {
                      const score = Number(emp.performance) || 0;
                      return (
                        <tr key={emp.id} style={{ borderBottom: `1px solid ${ind.rule}` }}>
                          <td style={{ padding: '9px 0', ...figure(12, ind.inkMuted) }}>{index + 1}</td>
                          <td style={{ padding: '9px 8px 9px 0', color: ind.ink, minWidth: 0 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getDemoEmployeeName(emp, t)}
                            </div>
                            <div style={{ fontSize: 11.5, color: ind.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t(`employeePosition.${emp.position}`, emp.position || '')}
                            </div>
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', ...figure(13, ind.inkMuted), whiteSpace: 'nowrap' }}>
                            {emp.overtime}h
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', ...figure(14, ind.ink) }}>
                            {score.toFixed(1)}
                          </td>
                          <td style={{ padding: '9px 0 9px 8px', width: 84 }}>
                            <Bar ind={ind} value={score / 5} fill={rampAt(ind, index)} marker={0.8} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Blueprint>
          </div>
        </div>

        {/* ── DECISION COLUMN — 372px fixed ──────────────────────────── */}
        <aside
          className="w-full lg:w-[372px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome }}
        >
          {/* Header block */}
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${ind.hairline}` }}>
            <button
              type="button"
              onClick={() => handleMetricClick('pendingRequests')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              title={t('dashboard.pendingRequests', 'Pending Requests')}
            >
              <ColumnHeading ind={ind}>{t('dashboard.needsDecision', 'Needs a Decision')}</ColumnHeading>
            </button>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span style={figure(26, ind.accent)}>{decisionQueue.length}</span>
              <span style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted }}>
                {t('dashboard.items', 'items')}
                {scope !== 'all' && ` · ${scopeLabel}`}
              </span>
            </div>
            <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 4 }}>
              {decisionQueue.length === 0
                ? t('dashboard.queueClear', 'Queue is clear')
                : `${t('dashboard.oldestWaited', 'Oldest has waited')} ${oldestWaited} ${oldestWaited === 1 ? t('common.day', 'day') : t('common.days', 'days')}`}
              {overdueCount > 0 && ` · ${overdueCount} ${t('dashboard.overdue', 'overdue')}`}
            </p>
            {/* The queue itself is time entries; the count also covers leave and
                overtime approvals, which are decided on their own screens. */}
            {pendingApprovalsCount > decisionQueue.length && (
              <p style={{ fontFamily: BODY, fontSize: 12, color: ind.inkFaint, marginTop: 2 }}>
                {`${pendingApprovalsCount} ${t('dashboard.pendingApprovalsTotal', 'pending across all approvals')}`}
              </p>
            )}
          </div>

          {/* Item hierarchy: tinted actionable ×2 → plain actionable → queued */}
          <div style={{ flex: 1 }}>
            {decisionQueue.length === 0 && (
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, padding: '18px 20px' }}>
                {t('dashboard.nothingPending', 'Nothing is waiting on you right now.')}
              </p>
            )}

            {decisionQueue.slice(0, 4).map((entry, i) => {
              const emp = entry.employee;
              const name = (emp ? getDemoEmployeeName(emp, t) : '') || entry.employeeName || t('common.unknown', 'Unknown');
              const hours = Number(entry.hours) || 0;
              const kind = entry.hour_type || entry.requestType || 'regular';
              const busy = decidingId === entry.id;
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '14px 20px',
                    background: i < 2 ? ind.accentWash : 'transparent',
                    borderBottom: `1px solid ${ind.rule}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.03em',
                      textTransform: 'uppercase', color: ind.ink, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </span>
                    <Tag ind={ind} variant={entry._waitedDays >= 2 ? 'outline' : 'accent'}>
                      {entry._waitedDays >= 2
                        ? t('dashboard.overdue', 'Overdue')
                        : t('common.pending', 'Pending')}
                    </Tag>
                  </div>

                  <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, marginTop: 5 }}>
                    {t(`timeClock.hourTypes.${kind}`, String(kind))} · {hours}h
                    {entry._when && ` · ${new Date(entry._when).toLocaleDateString()}`}
                  </p>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Btn ind={ind} variant="primary" disabled={busy} onClick={() => handleDecision(entry, 'approved')}>
                      {t('common.approve', 'Approve')}
                    </Btn>
                    <Btn ind={ind} variant="secondary" disabled={busy} onClick={() => handleDecision(entry, 'rejected')}>
                      {t('common.decline', 'Decline')}
                    </Btn>
                  </div>
                </div>
              );
            })}

            {/* Queued — no buttons, arrow right, opens the full table */}
            {decisionQueue.slice(4, 9).map((entry) => {
              const emp = entry.employee;
              const name = (emp ? getDemoEmployeeName(emp, t) : '') || entry.employeeName || t('common.unknown', 'Unknown');
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleMetricClick('pendingRequests')}
                  className="w-full"
                  style={{
                    padding: '12px 20px', background: 'transparent', border: 'none',
                    borderBottom: `1px solid ${ind.rule}`, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: BODY, fontSize: 13, color: ind.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                    <span style={{ display: 'block', fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                      {t(`timeClock.hourTypes.${entry.hour_type || 'regular'}`, String(entry.hour_type || 'regular'))} · {Number(entry.hours) || 0}h
                    </span>
                  </span>
                  <ArrowRight size={15} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                </button>
              );
            })}

            {decisionQueue.length > 9 && (
              <button
                type="button"
                onClick={() => handleMetricClick('pendingRequests')}
                className="w-full"
                style={{
                  padding: '12px 20px', background: 'transparent', border: 'none',
                  borderBottom: `1px solid ${ind.rule}`, cursor: 'pointer', textAlign: 'left',
                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: ind.accentDeep,
                }}
              >
                {`+${decisionQueue.length - 9} ${t('dashboard.more', 'more')} — ${t('dashboard.viewAll', 'View All')}`}
              </button>
            )}
          </div>

          {/* Second section — hiring */}
          <div style={{ ...sectionRule, padding: '18px 20px 22px' }}>
            <button
              type="button"
              onClick={() => handleMetricClick('applications')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              title={t('dashboard.activeApplications', 'Active Applications')}
            >
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <ColumnHeading ind={ind} style={{ fontSize: 13 }}>
                  {t('nav.recruitment', 'Hiring')}
                </ColumnHeading>
                <span style={figure(16, ind.ink)}>{applications.length}</span>
              </div>
            </button>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {applications.length === 0 && (
                <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>
                  {t('dashboard.noApplications', 'No active applications')}
                </p>
              )}
              {applications.length > 0 && pipeline.map((stage, i) => (
                <div key={stage.key}>
                  <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost }}>{stage.label}</span>
                    <span style={figure(13, ind.ink)}>{stage.value}</span>
                  </div>
                  <Bar ind={ind} value={stage.value / pipelineMax} fill={rampAt(ind, i)} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Metric Detail Modal */}
      <MetricDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        metricType={modalConfig.type}
        data={modalConfig.data}
        title={modalConfig.title}
      />
    </div>
  );
};

export default Dashboard;
