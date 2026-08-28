import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useLanguage, SUPPORTED_LANGUAGES } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription, getDemoGoalTitle, getDemoGoalDescription, getDemoTimeEntries } from '../utils/demoHelper';
import {
  Download,
  Goal,
  Clock,
  CheckCircle,
  FileText,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  X
} from 'lucide-react';
import timeTrackingService from '../services/timeTrackingService';
import { withTimeout } from '../utils/supabaseTimeout';
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts';
import { getAllTasks } from '../services/workloadService';
import performanceService from '../services/performanceService';
import { validateAndRefreshSession } from '../utils/sessionHelper';
import { retryWithBackoff, isRetryableError } from '../utils/retryHelper';
import { supabase } from '../config/supabaseClient';
import {
  aggregateCounts,
  aggregateHoursByType,
  buildCombinedCsvContent,
  computeEmployeePerformance,
  computeExportStats,
  countWorkingDays,
  createPdfReportLayout,
  filterExportSnapshotByScope,
  formatHours,
  getTaskDurationDays,
  loadPdfLogo,
  meterFilledBlocks,
  PDF_TOKENS,
  withBarPercents
} from '../utils/reportExportHelpers.js';
import { TranslatedText } from './ui/translated-text.jsx';
import { translateTexts } from '../services/translateService.js';
import { SpecularButton } from './ui/specular-button';
import { SlidingNumber } from './motion-primitives';
import { NumberTicker } from './ui/number-ticker';
import { DatePicker } from './ui/date-picker.jsx';
import { formatDate } from '../utils/localeFormat.js';
import { cn } from '@/lib/utils';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import { Bar, Tag, Btn, Seg, Kicker, ColumnHeading, TickerCell, LiveClock, FlatSelect, FlatListbox } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import {
  choosePdfFont,
  getPdfTableFont,
  loadPdfFonts,
  pdfFontSupportsBold,
  prefetchPdfFonts,
} from '../utils/pdfFontLoader.js';
import {
  filterActiveEmployees,
} from '../utils/employeeStatus.js';
import { getEmployeePositionI18nKey } from '../utils/employeePositionKey.js';

// exceljs/jspdf are ~1.2 MB and are only needed once the user actually exports —
// loaded on demand so opening the Reports page stays cheap.
const loadExcelJs = () => import('exceljs').then((m) => m.default ?? m);
const loadPdfLibs = async () => {
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  return { jsPDF: jsPdfModule.jsPDF, autoTable: autoTableModule.default ?? autoTableModule };
};

/**
 * The four record types the sheet can put in an export. Scope is a set, not a
 * tab: an export normally carries several of them at once.
 */
const SCOPE_KEYS = ['timeEntries', 'leave', 'tasks', 'goals'];

/** Rows shown in the preview before "Load 50" is pressed. */
const PREVIEW_PAGE = 50;

/**
 * The date a record sits on for period purposes. Time entries and leave carry a
 * real date; a task or a goal is placed by when it is due, and an undated one by
 * when it was raised, so nothing drops out of the period for want of a due date.
 */
const recordDate = (item) =>
  String(item?.date || item?.due_date || item?.target_date || item?.start_date || item?.created_at || '').slice(0, 10);

const withinRange = (item, startDate, endDate) => {
  const date = recordDate(item);
  return Boolean(date) && date >= startDate && date <= endDate;
};

/** ISO-8601 week number, so the volume strip agrees with payroll's week labels. */
const isoWeekNumber = (date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Hours booked against one person on one day, past which the entry is far more
 * often a duplicate punch than a real shift. Flagged before export, not blocked.
 */
const LONG_SHIFT_HOURS = 12;

/** The page head reports the last file that actually left, so it is written on success. */
const LAST_EXPORT_KEY = 'icue.reports.lastExport';

/* ------------------------------------------------------------------ *
 * Sheet primitives. Module level, so a re-render of the screen does not
 * remount the selects and date pickers living inside them.
 * ------------------------------------------------------------------ */

/** The four registration crosses that mark a band of the sheet. */
function BandMarks({ ind }) {
  return (
    <>
      {[
        { top: -5, left: -5 }, { top: -5, right: -5 },
        { bottom: -5, left: -5 }, { bottom: -5, right: -5 },
      ].map((position, index) => (
        <span key={index} aria-hidden="true" style={{ position: 'absolute', width: 11, height: 11, ...position }}>
          <span style={{ position: 'absolute', top: 5, left: 0, width: 11, height: 1, background: ind.inkFaint }} />
          <span style={{ position: 'absolute', left: 5, top: 0, width: 1, height: 11, background: ind.inkFaint }} />
        </span>
      ))}
    </>
  );
}

/**
 * A band is a hairline grid: the 1px gaps let the band's own background show
 * through, so the rules stay continuous however the columns wrap.
 */
function Band({ ind, className, children }) {
  return (
    <div style={{ position: 'relative', margin: '0 0 26px' }}>
      <BandMarks ind={ind} />
      <div
        className={className}
        style={{
          display: 'grid', gap: 1, background: ind.hairline,
          border: `1px solid ${ind.hairline}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Cell({ ind, className, children }) {
  return (
    <div className={className} style={{ background: ind.ground, padding: '14px 16px 16px', minWidth: 0 }}>
      {children}
    </div>
  );
}

/** Numbered panel heading — "01 · RECORDS". */
function PanelHead({ ind, num, title, right }) {
  return (
    <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 12 }}>
      <div className="flex items-baseline" style={{ gap: 8, minWidth: 0 }}>
        {num && (
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', color: ind.accent }}>
            {num}
          </span>
        )}
        <span
          style={{
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.14em',
            textTransform: 'uppercase', color: ind.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

/** One figure block: the form every derived number on this screen takes. */
function FigureBlock({ ind, label, value, suffix, description, size = 22 }) {
  return (
    <div style={{ border: `1px solid ${ind.hairline}`, padding: '9px 11px', minWidth: 0 }}>
      <Kicker ind={ind}>{label}</Kicker>
      <div className="flex items-baseline" style={{ gap: 3, margin: '5px 0 0' }}>
        <span style={{ ...figure(size, ind.ink), lineHeight: 1 }}>
          <SlidingNumber value={value} />
        </span>
        {suffix && <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{suffix}</span>}
      </div>
      <p
        style={{
          fontFamily: BODY, fontSize: 11, color: ind.inkFaint, margin: '4px 0 0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {description}
      </p>
    </div>
  );
}

/** A label / figure line inside a breakdown box. */
function StatLine({ ind, label, value, suffix, decimals }) {
  return (
    <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
      <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, minWidth: 0 }}>{label}</span>
      <span
        style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink,
          fontVariantNumeric: 'tabular-nums', flex: 'none',
        }}
      >
        {/* Counts snap between whole numbers; a rate rolls its decimal. */}
        {decimals != null
          ? <NumberTicker value={value} decimalPlaces={decimals} />
          : <SlidingNumber value={value} />}
        {suffix}
      </span>
    </div>
  );
}

const readLastExport = () => {
  try {
    const raw = window.localStorage.getItem(LAST_EXPORT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.filename ? parsed : null;
  } catch {
    return null;
  }
};

const Reports = () => {
  const { handleSessionAuthError } = useSessionGuard();
  const { t, currentLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);

  // Helper function to translate department values
  const translateDepartment = (department) => {
    if (!department) return '';
    return t(`employeeDepartment.${department}`, department);
  };
  
  // Helper function to translate position values
  const translatePosition = (position) => {
    if (!position) return '';
    const key = getEmployeePositionI18nKey(position);
    return key ? t(`employeePosition.${key}`, position) : position;
  };
  
  // Helper function to translate category labels
  const translateCategory = (category) => {
    if (!category) return '';
    const categoryMap = {
      'general': t('personalGoals.general', 'General'),
      'technical': t('personalGoals.technical', 'Technical'),
      'leadership': t('personalGoals.leadership', 'Leadership'),
      'project': t('personalGoals.project', 'Project'),
      'professional_development': t('personalGoals.professionalDevelopment', 'Professional Development')
    };
    return categoryMap[category] || category;
  };
  
  const translateHourType = (hourType) => {
    if (!hourType) return '';
    const type = hourType.toLowerCase();
    switch (type) {
      case 'regular':
        return t('timeClock.hourTypes.regular', 'Regular Hours');
      case 'holiday':
        return t('timeClock.hourTypes.holiday', 'Holiday Hours');
      case 'weekend':
        return t('timeClock.hourTypes.weekend', 'Weekend Overtime');
      case 'overtime':
        return t('timeClock.hourTypes.overtime', 'Overtime');
      case 'bonus':
        return t('timeClock.hourTypes.bonus', 'Bonus Hours');
      case 'wfh':
        return t('timeClock.hourTypes.wfh', 'Working From Home');
      case 'on_leave':
        return t('timeClock.hourTypes.onLeave', 'On Leave');  
      default:
        return hourType;
    }
  };

  const translateLeaveType = (leaveType) => {
    if (!leaveType) return '';
    const type = leaveType.toLowerCase();
    switch (type) {
      case 'sick':
        return t('timeTracking.sickLeave', 'Sick Leave');
      case 'personal':
        return t('timeTracking.personal', 'Personal');
      case 'vacation':
        return t('timeTracking.vacation', 'Vacation');
      default:
        return leaveType;
    }
  };

  // Helper function to translate status
  const translateStatus = (status) => {
    if (!status) return '';
    const stat = status.toLowerCase();
    switch (stat) {
      case 'pending':
        return t('reports.statusPending', 'Pending');
      case 'approved':
        return t('reports.statusApproved', 'Approved');
      case 'rejected':
        return t('reports.statusRejected', 'Rejected');
      case 'completed':
        return t('reports.statusCompleted', 'Completed');
      case 'in progress':
      case 'in_progress':
      case 'in-progress':
        return t('reports.statusInProgress', 'In Progress');
      case 'not started':
      case 'not_started':
      case 'not-started':
        return t('reports.statusNotStarted', 'Not Started');
      default:
        return status;
    }
  };

  // Helper function to translate priority
  const translatePriority = (priority) => {
    if (!priority) return '';
    const prio = priority.toLowerCase();
    switch (prio) {
      case 'low':
        return t('reports.priorityLow', 'Low');
      case 'medium':
        return t('reports.priorityMedium', 'Medium');
      case 'high':
        return t('reports.priorityHigh', 'High');
      default:
        return priority;
    }
  };

  // Localizes the "Entered by admin:" prefix; the free-text body is looked up
  // from the pre-translated UGC map when one is supplied (export paths).
  const translateNotes = (notes, ugcMap = null) => {
    if (!notes) return '';
    // Check if notes starts with "Entered by admin:" (case insensitive, optional colon)
    const adminPrefixRegex = /^Entered by admin:?\s*/i;
    const match = notes.match(adminPrefixRegex);

    if (match) {
      const translatedPrefix = t('timeTracking.enteredByAdmin', 'Entered by admin:');
      const body = notes.slice(match[0].length);
      // Replace the matched prefix with the translated one and ensure a space follows
      return translatedPrefix + ' ' + (ugcMap ? (ugcMap.get(body) ?? body) : body);
    }
    return ugcMap ? (ugcMap.get(notes) ?? notes) : notes;
  };

  // State
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // 01 · Records — which record types the export carries.
  const [scope, setScope] = useState({ timeEntries: true, leave: true, tasks: true, goals: true });
  // 02 · People
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);
  // 03 · Period
  const [dateRange, setDateRange] = useState('this-month');
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Preview ledger
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [visibleRows, setVisibleRows] = useState(PREVIEW_PAGE);
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set());
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  /** Set by the "before you export" checks: narrows the preview to the rows a check is about. */
  const [attention, setAttention] = useState(null);
  const [peopleListOpen, setPeopleListOpen] = useState(false);

  // Export dock
  const [exportFormat, setExportFormat] = useState('csv');
  const [lastExport, setLastExport] = useState(readLastExport);

  const columnMenuRef = useRef(null);

  // Data state
  const [reportData, setReportData] = useState({
    timeEntries: [],
    tasks: [],
    goals: [],
    leave: [],
    employees: []
  });

  // Warm PDF font cache for CJK/Thai exports so the first PDF download is reliable.
  useEffect(() => {
    prefetchPdfFonts(currentLanguage);
  }, [currentLanguage]);

  // Get employees list
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const employeesResponse = await timeTrackingService.getAllEmployees();
        const employees = employeesResponse.success ? employeesResponse.data : [];
        console.log('Loaded employees:', employees.map(e => ({ id: e.id, type: typeof e.id, name: e.name })));
        setReportData(prev => ({ ...prev, employees }));
      } catch (error) {
        console.error('Error fetching employees:', error);
        handleSessionAuthError(error);
      }
    };
    fetchEmployees();
  }, []);

  const activeEmployees = useMemo(
    () => filterActiveEmployees(reportData.employees),
    [reportData.employees]
  );

  /** Units come off the roster; there is no unit table to read them from. */
  const units = useMemo(() => {
    const source = activeOnly ? activeEmployees : reportData.employees;
    return [...new Set(source.map((emp) => emp.department).filter(Boolean))].sort();
  }, [activeOnly, activeEmployees, reportData.employees]);

  /**
   * 02 · People resolved into the one list every figure on the sheet is scoped
   * to. A named person wins over a unit, a unit over the whole roster.
   */
  const cohort = useMemo(() => {
    if (selectedEmployee !== 'all') {
      return reportData.employees.filter((emp) => String(emp.id) === String(selectedEmployee));
    }
    let list = activeOnly ? activeEmployees : reportData.employees;
    if (selectedUnit !== 'all') {
      list = list.filter((emp) => (emp.department || '') === selectedUnit);
    }
    return list;
  }, [selectedEmployee, selectedUnit, activeOnly, activeEmployees, reportData.employees]);

  const cohortIds = useMemo(() => new Set(cohort.map((emp) => String(emp.id))), [cohort]);

  /**
   * Rows belong to the cohort by employee id. Until the roster has loaded there
   * is nothing to match against, so everything passes rather than nothing.
   */
  const inCohort = useCallback((item) => {
    if (reportData.employees.length === 0) return true;
    const id = item?.employee_id ?? item?.employee?.id;
    if (id == null) return false;
    return cohortIds.has(String(id));
  }, [cohortIds, reportData.employees.length]);

  // Update date filters when range changes
  useEffect(() => {
    const today = new Date();
    let startDate, endDate = today.toISOString().split('T')[0];

    switch (dateRange) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        break;
      case 'this-week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startDate = startOfWeek.toISOString().split('T')[0];
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endDate = endOfWeek.toISOString().split('T')[0];
        break;
      case 'this-month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'last-month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        startDate = lastMonth.toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this-quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), (quarter * 3) + 3, 0).toISOString().split('T')[0];
        break;
      case 'this-year':
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      default:
    
        return;
    }

    if (dateRange !== 'custom') {
      setFilters({ startDate, endDate });
    }
  }, [dateRange]);

  // Fetch data when filters change
  const fetchReportData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
      setFetchError(null); // Clear any previous errors
    }
    try {
      // Skip session validation in demo mode - demo data doesn't require authentication
      if (!isDemoMode()) {
        // Validate session before fetching
        const sessionValidation = await validateAndRefreshSession();
        if (!sessionValidation.success) {
          throw new Error(sessionValidation.error);
        }
      }
      
      // Wrap fetch logic with retry mechanism
      await retryWithBackoff(async () => {
        const { startDate, endDate } = filters;
        // Don't parse as int - IDs might be UUIDs
        const employeeId = selectedEmployee === 'all' ? null : selectedEmployee;

      const fetchTimeEntries = async () => {
        let allTimeEntries = [];
        let error = null;

        if (isDemoMode()) {
          const demoEntries = getDemoTimeEntries();
          allTimeEntries = demoEntries
            .filter(entry => entry.date && entry.date >= startDate && entry.date <= endDate)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
          const result = await withTimeout(
            supabase
              .from('time_entries')
              .select(`
                *,
                employee:employees!time_entries_employee_id_fkey(id, name, department, position)
              `)
              .gte('date', startDate)
              .lte('date', endDate)
              .order('date', { ascending: false })
              .limit(10000),
            DEFAULT_REQUEST_TIMEOUT
          );
          allTimeEntries = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching time entries:', error);
          return [];
        }

        let filteredEntries = allTimeEntries || [];
        if (employeeId) {
          filteredEntries = filteredEntries.filter(entry =>
            String(entry.employee_id) === String(employeeId)
          );
        }
        return filteredEntries;
      };

      const fetchTasks = async () => {
        const tasksResponse = await getAllTasks(employeeId ? { employeeId } : {});
        let tasks = tasksResponse.success ? tasksResponse.data : [];
        if (employeeId) {
          tasks = tasks.filter(task => String(task.employee_id) === String(employeeId));
        }
        return tasks.filter(task => withinRange(task, startDate, endDate));
      };

      const fetchGoals = async () => {
        const goalsResponse = await performanceService.getAllPerformanceGoals(
          employeeId ? { employeeId } : {}
        );
        let goals = goalsResponse.success ? goalsResponse.data : [];
        if (employeeId) {
          goals = goals.filter(goal => String(goal.employee_id) === String(employeeId));
        }
        return goals.filter(goal => withinRange(goal, startDate, endDate));
      };

      const fetchLeave = async () => {
        const leaveResponse = await timeTrackingService.getAllLeaveRequests({});
        let leaveData = leaveResponse.success ? leaveResponse.data : [];
        if (employeeId) {
          leaveData = leaveData.filter(req => String(req.employee_id) === String(employeeId));
        }
        leaveData = leaveData.filter(req => {
          const s = (req.start_date || '').slice(0, 10);
          const e = (req.end_date || req.start_date || '').slice(0, 10);
          return s <= endDate && e >= startDate;
        });
        return leaveData;
      };

      // All four types are always loaded: scope is a set of tick boxes now, and
      // ticking one must not cost a round trip.
      const [timeEntries, tasks, goals, leaveData] = await Promise.all([
        fetchTimeEntries(),
        fetchTasks(),
        fetchGoals(),
        fetchLeave(),
      ]);

      setReportData(prev => ({
        ...prev,
        timeEntries,
        tasks,
        goals,
        // Leave arrives without its employee joined; the roster already loaded
        // is the only place to resolve the name and unit from.
        leave: leaveData.map(req => ({
          ...req,
          employee: req.employee || prev.employees.find(emp => String(emp.id) === String(req.employee_id)) || null
        }))
      }));
      }, {
        maxRetries: 2,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt, delay) => {
          console.log(`🔄 Reports: Retrying fetch (${attempt}/2) after ${delay}ms...`);
        }
      });
    } catch (error) {
      console.error('Error fetching report data:', error);

      if (handleSessionAuthError(error, { silent, setFetchError })) {
        if (!silent) setLoading(false);
        return;
      }
      
      // Set user-visible error message for other errors
      setFetchError(t('errors.loadFailed', 'Failed to load data'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, selectedEmployee, handleSessionAuthError]);

  const loadAllReportDataForExport = useCallback(async () => {
    const { startDate, endDate } = filters;
    const employeeId = selectedEmployee === 'all' ? null : selectedEmployee;

    if (!isDemoMode()) {
      const sessionValidation = await validateAndRefreshSession();
      if (!sessionValidation.success) {
        throw new Error(sessionValidation.error);
      }
    }

    let allTimeEntries = [];
    if (isDemoMode()) {
      allTimeEntries = getDemoTimeEntries()
        .filter((entry) => entry.date && entry.date >= startDate && entry.date <= endDate)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      const { data, error } = await withTimeout(
        supabase
          .from('time_entries')
          .select(`
            *,
            employee:employees!time_entries_employee_id_fkey(id, name, department, position)
          `)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })
          .limit(10000),
        DEFAULT_REQUEST_TIMEOUT
      );
      if (error) throw error;
      allTimeEntries = data || [];
    }

    if (employeeId) {
      allTimeEntries = allTimeEntries.filter((entry) => String(entry.employee_id) === String(employeeId));
    }

    const tasksResponse = await getAllTasks(employeeId ? { employeeId } : {});
    let tasks = tasksResponse.success ? tasksResponse.data || [] : [];
    if (employeeId) {
      tasks = tasks.filter((task) => String(task.employee_id) === String(employeeId));
    }
    tasks = tasks.filter((task) => withinRange(task, startDate, endDate));

    const goalsResponse = await performanceService.getAllPerformanceGoals(employeeId ? { employeeId } : {});
    let goals = goalsResponse.success ? goalsResponse.data || [] : [];
    if (employeeId) {
      goals = goals.filter((goal) => String(goal.employee_id) === String(employeeId));
    }
    goals = goals.filter((goal) => withinRange(goal, startDate, endDate));

    const leaveResponse = await timeTrackingService.getAllLeaveRequests({});
    let leave = leaveResponse.success ? leaveResponse.data || [] : [];
    if (employeeId) {
      leave = leave.filter((req) => String(req.employee_id) === String(employeeId));
    }
    leave = leave
      .filter((req) => {
        const s = (req.start_date || '').slice(0, 10);
        const e = (req.end_date || req.start_date || '').slice(0, 10);
        return s <= endDate && e >= startDate;
      })
      .map((req) => ({
        ...req,
        employee: req.employee || reportData.employees.find((emp) => String(emp.id) === String(req.employee_id)) || null,
      }));

    // The screen keeps the unscoped fetch so the figures stay live; the export
    // gets the cohort-narrowed copy so the file matches what 02 · People says.
    setReportData((prev) => ({ ...prev, timeEntries: allTimeEntries, tasks, goals, leave }));

    return {
      timeEntries: allTimeEntries.filter(inCohort),
      tasks: tasks.filter(inCohort),
      goals: goals.filter(inCohort),
      leave: leave.filter(inCohort),
      employees: cohort,
    };
  }, [filters, selectedEmployee, reportData.employees, inCohort, cohort]);

  const getFilteredExportData = useCallback(async () => {
    const snapshot = await loadAllReportDataForExport();
    return filterExportSnapshotByScope(scope, snapshot);
  }, [loadAllReportDataForExport, scope]);

  // Effect to fetch data when filters/tab/employee changes (no need to wait for employees list)
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Memoize fetchReportData for use in visibility hook
  const memoizedFetchReportData = useCallback(() => {
    fetchReportData({ silent: true });
  }, [fetchReportData]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useAuthenticatedPageRefresh(memoizedFetchReportData);

  // Handle sort column click
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  /* ------------------------------------------------------------------ *
   * Derived sheet state.
   *
   * One chain — cohort → scope → ledger — feeds the ticker, the
   * composition band, the preview and the export dock. They read the same
   * arrays, so the sheet cannot report two different totals for one export.
   * ------------------------------------------------------------------ */

  /** Everything the 02 · People selection allows, before the scope ticks. */
  const cohortData = useMemo(() => ({
    timeEntries: (reportData.timeEntries || []).filter(inCohort),
    leave: (reportData.leave || []).filter(inCohort),
    tasks: (reportData.tasks || []).filter(inCohort),
    goals: (reportData.goals || []).filter(inCohort),
  }), [reportData.timeEntries, reportData.leave, reportData.tasks, reportData.goals, inCohort]);

  /** The export scope proper: the cohort narrowed to the ticked record types. */
  const scopedData = useMemo(() => ({
    timeEntries: scope.timeEntries ? cohortData.timeEntries : [],
    leave: scope.leave ? cohortData.leave : [],
    tasks: scope.tasks ? cohortData.tasks : [],
    goals: scope.goals ? cohortData.goals : [],
  }), [cohortData, scope]);

  const employeeById = useMemo(() => {
    const map = new Map();
    (reportData.employees || []).forEach((emp) => map.set(String(emp.id), emp));
    return map;
  }, [reportData.employees]);

  /** approved_by / assigned_by / created_by are employee ids, not names. */
  const nameOfEmployeeId = useCallback((id) => {
    if (id == null || id === '') return '';
    const employee = employeeById.get(String(id));
    return employee ? getDemoEmployeeName(employee, t) : '';
  }, [employeeById, t]);

  /**
   * One row model for all four record types. The preview is a ledger of the
   * export rather than a table per type, so a leave request and a time entry
   * have to line up in the same columns.
   */
  const ledgerRows = useMemo(() => {
    const rows = [];
    const dash = '—';

    const common = (item) => {
      const employee = item.employee || employeeById.get(String(item.employee_id)) || null;
      return {
        employeeId: String(item.employee_id ?? employee?.id ?? ''),
        employee: employee ? getDemoEmployeeName(employee, t) : t('reports.unknown', 'Unknown'),
        unit: translateDepartment(employee?.department) || dash,
        status: String(item.status || '').toLowerCase(),
      };
    };

    scopedData.timeEntries.forEach((entry, index) => {
      const premium = ['overtime', 'bonus', 'weekend', 'holiday'].includes(String(entry.hour_type || '').toLowerCase());
      rows.push({
        ...common(entry),
        key: `time-${entry.id ?? index}`,
        kind: 'time',
        date: recordDate(entry),
        note: entry.notes ? translateNotes(entry.notes) : '',
        noteIsUgc: false,
        typeLabel: translateHourType(entry.hour_type) || t('reports.type', 'Type'),
        typeVariant: premium ? 'outline' : 'neutral',
        amount: Number(entry.hours) || 0,
        amountText: formatHours(entry.hours),
        approvedBy: nameOfEmployeeId(entry.approved_by),
        source: t('reports.sourceTime', 'Time entries'),
      });
    });

    scopedData.leave.forEach((request, index) => {
      rows.push({
        ...common(request),
        key: `leave-${request.id ?? index}`,
        kind: 'leave',
        date: (request.start_date || '').slice(0, 10),
        note: [
          `${(request.start_date || '').slice(0, 10)} → ${(request.end_date || request.start_date || '').slice(0, 10)}`,
          request.reason || '',
        ].filter(Boolean).join(' · '),
        noteIsUgc: false,
        typeLabel: translateLeaveType(request.leave_type),
        typeVariant: 'neutral',
        amount: Number(request.days_count) || 0,
        amountText: `${Number(request.days_count) || 0} ${t('reports.daysShort', 'd')}`,
        approvedBy: nameOfEmployeeId(request.approved_by),
        source: t('reports.sourceLeave', 'Leave management'),
      });
    });

    scopedData.tasks.forEach((task, index) => {
      rows.push({
        ...common(task),
        key: `task-${task.id ?? index}`,
        kind: 'task',
        date: recordDate(task),
        note: isDemoMode() ? getDemoTaskTitle(task, t) : (task.title || ''),
        noteIsUgc: !isDemoMode(),
        typeLabel: translatePriority(task.priority) || t('dataType.task', 'Task'),
        typeVariant: String(task.priority || '').toLowerCase() === 'high' ? 'outline' : 'neutral',
        amount: 0,
        amountText: dash,
        approvedBy: nameOfEmployeeId(task.created_by),
        source: t('reports.sourceTasks', 'Task listing'),
      });
    });

    scopedData.goals.forEach((goal, index) => {
      const progress = goal.status === 'completed' ? 100 : (Number(goal.progress) || 0);
      rows.push({
        ...common(goal),
        key: `goal-${goal.id ?? index}`,
        kind: 'goal',
        date: recordDate(goal),
        note: isDemoMode() ? getDemoGoalTitle(goal, t) : (goal.title || ''),
        noteIsUgc: !isDemoMode(),
        typeLabel: translateCategory(goal.category) || t('dataType.goal', 'Goal'),
        typeVariant: 'neutral',
        amount: progress,
        amountText: `${progress}%`,
        approvedBy: nameOfEmployeeId(goal.assigned_by),
        source: t('reports.sourceGoals', 'Personal goals'),
      });
    });

    return rows;
  }, [scopedData, employeeById, nameOfEmployeeId, t]);

  /** Time entries and leave are the two types anyone approves. */
  const approvableRows = useMemo(
    () => [...scopedData.timeEntries, ...scopedData.leave],
    [scopedData]
  );

  const totals = useMemo(() => {
    const hours = scopedData.timeEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    return {
      rows: ledgerRows.length,
      hours,
      pending: approvableRows.filter((row) => String(row.status).toLowerCase() === 'pending').length,
      people: cohort.length,
      workingDays: countWorkingDays(filters.startDate, filters.endDate),
    };
  }, [ledgerRows.length, scopedData.timeEntries, approvableRows, cohort.length, filters.startDate, filters.endDate]);

  /** Counts for 01 · RECORDS, including the types that are not ticked. */
  const availableCounts = useMemo(() => ({
    timeEntries: cohortData.timeEntries.length,
    leave: cohortData.leave.length,
    tasks: cohortData.tasks.length,
    goals: cohortData.goals.length,
  }), [cohortData]);

  /** Composition by record type: counts, because the % column has to share one unit. */
  const byType = useMemo(() => {
    const rows = [];

    if (scope.timeEntries) {
      const buckets = new Map();
      scopedData.timeEntries.forEach((entry) => {
        const key = String(entry.hour_type || 'regular').toLowerCase();
        const bucket = buckets.get(key) || { count: 0, hours: 0 };
        bucket.count += 1;
        bucket.hours += Number(entry.hours) || 0;
        buckets.set(key, bucket);
      });
      buckets.forEach((bucket, key) => {
        rows.push({ id: `hour-${key}`, label: translateHourType(key), count: bucket.count, hours: bucket.hours });
      });
    }
    if (scope.leave && scopedData.leave.length > 0) {
      rows.push({ id: 'leave', label: t('reports.leave', 'Leave Requests'), count: scopedData.leave.length });
    }
    if (scope.tasks && scopedData.tasks.length > 0) {
      rows.push({ id: 'tasks', label: t('reports.tasks', 'Tasks'), count: scopedData.tasks.length });
    }
    if (scope.goals && scopedData.goals.length > 0) {
      rows.push({ id: 'goals', label: t('reports.personalGoals', 'Personal Goals'), count: scopedData.goals.length });
    }

    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows
      .sort((a, b) => b.count - a.count)
      .map((row) => ({ ...row, pct: total > 0 ? row.count / total : 0 }));
  }, [scope, scopedData, t]);

  /** Approval state of everything approvable in scope. */
  const byStatus = useMemo(() => {
    const countOf = (status) =>
      approvableRows.filter((row) => String(row.status).toLowerCase() === status).length;
    return {
      total: approvableRows.length,
      approved: countOf('approved'),
      pending: countOf('pending'),
      rejected: countOf('rejected'),
    };
  }, [approvableRows]);

  /**
   * Volume across the period. Weeks up to ten of them, months beyond that, so
   * the strip never turns into a hairline comb.
   */
  const byWeek = useMemo(() => {
    const start = new Date(`${filters.startDate}T00:00:00`);
    const end = new Date(`${filters.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

    const spanDays = Math.round((end - start) / 86400000) + 1;
    const monthly = spanDays > 70;
    const bucketStart = (date) => {
      if (monthly) return new Date(date.getFullYear(), date.getMonth(), 1);
      const copy = new Date(date);
      copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); // ISO weeks start Monday
      return copy;
    };
    const nextBucket = (date) => (monthly
      ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7));

    const buckets = [];
    for (let cursor = bucketStart(start); cursor <= end; cursor = nextBucket(cursor)) {
      const from = new Date(cursor);
      const to = new Date(nextBucket(cursor).getTime() - 86400000);
      buckets.push({
        from,
        to,
        label: monthly
          ? from.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
          : `W${isoWeekNumber(from)}`,
        count: 0,
        partial: false,
      });
    }
    if (buckets.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    buckets.forEach((bucket) => {
      bucket.partial = today >= bucket.from && today <= bucket.to;
    });

    ledgerRows.forEach((row) => {
      if (!row.date) return;
      const date = new Date(`${row.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      for (let i = buckets.length - 1; i >= 0; i -= 1) {
        if (date >= buckets[i].from) {
          if (date <= buckets[i].to) buckets[i].count += 1;
          return;
        }
      }
    });

    const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
    return buckets.map((bucket) => ({ ...bucket, share: bucket.count / max }));
  }, [filters.startDate, filters.endDate, ledgerRows]);

  /** employee|date pairs carrying more than a plausible day of work. */
  const longShiftKeys = useMemo(() => {
    const perDay = new Map();
    scopedData.timeEntries.forEach((entry) => {
      const key = `${entry.employee_id}|${recordDate(entry)}`;
      perDay.set(key, (perDay.get(key) || 0) + (Number(entry.hours) || 0));
    });
    const flagged = new Set();
    perDay.forEach((hours, key) => {
      if (hours > LONG_SHIFT_HOURS) flagged.add(key);
    });
    return flagged;
  }, [scopedData.timeEntries]);

  const peopleWithNoRecords = useMemo(() => {
    if (reportData.employees.length === 0) return [];
    const covered = new Set(ledgerRows.map((row) => row.employeeId).filter(Boolean));
    return cohort.filter((employee) => !covered.has(String(employee.id)));
  }, [cohort, ledgerRows, reportData.employees.length]);

  /**
   * Before you export: everything about this scope that the person pressing
   * Export would rather know now than find in the file. Each one carries the
   * action that resolves it.
   */
  const checks = useMemo(() => {
    const list = [];
    const isPending = (row) => String(row.status).toLowerCase() === 'pending';
    const pendingTime = scopedData.timeEntries.filter(isPending).length;
    const pendingLeave = scopedData.leave.filter(isPending).length;
    const rejected = approvableRows.filter((row) => String(row.status).toLowerCase() === 'rejected').length;

    if (pendingTime > 0) {
      list.push({
        id: 'pending-time',
        Icon: AlertTriangle,
        lead: `${pendingTime} ${t('reports.checkEntriesPending', 'entries are still pending')}`,
        rest: t('reports.checkExportsAsPending', 'they will export with status PENDING.'),
        actionLabel: t('reports.checkApproveFirst', 'Approve first'),
        onAction: () => navigate('/time-tracking'),
      });
    }
    if (pendingLeave > 0) {
      list.push({
        id: 'pending-leave',
        Icon: AlertTriangle,
        lead: `${pendingLeave} ${t('reports.checkLeavePending', 'leave requests are still pending')}`,
        rest: t('reports.checkExportsAsPending', 'they will export with status PENDING.'),
        actionLabel: t('reports.checkOpenLeave', 'Open leave'),
        onAction: () => navigate('/leave-management'),
      });
    }
    if (peopleWithNoRecords.length > 0) {
      const names = peopleWithNoRecords.slice(0, 2).map((employee) => getDemoEmployeeName(employee, t)).join(', ');
      const extra = peopleWithNoRecords.length - Math.min(2, peopleWithNoRecords.length);
      list.push({
        id: 'no-records',
        Icon: AlertTriangle,
        lead: `${peopleWithNoRecords.length} ${t('reports.checkPeopleNoRecords', 'people have no records in range')}`,
        rest: extra > 0 ? `${names} +${extra}` : names,
        actionLabel: t('reports.checkOpenList', 'Open list'),
        onAction: () => setPeopleListOpen(true),
      });
    }
    if (longShiftKeys.size > 0) {
      list.push({
        id: 'long-shift',
        Icon: Clock,
        lead: `${longShiftKeys.size} ${t('reports.checkLongShifts', 'days booked over 12h for one person')}`,
        rest: t('reports.checkLongShiftsNote', 'usually a duplicate punch rather than a real shift.'),
        actionLabel: t('reports.checkReview', 'Review'),
        onAction: () => setAttention('long-shift'),
      });
    }
    if (rejected > 0) {
      list.push({
        id: 'rejected',
        Icon: AlertCircle,
        lead: `${rejected} ${t('reports.checkRejectedRows', 'rejected rows are in scope')}`,
        rest: t('reports.checkRejectedNote', 'they export with status REJECTED.'),
        actionLabel: t('reports.checkReview', 'Review'),
        onAction: () => setAttention('rejected'),
      });
    }
    return list;
  }, [scopedData, approvableRows, peopleWithNoRecords, longShiftKeys, navigate, t]);

  /* ── Preview ledger: attention filter → sort → page ──────────────── */

  const attentionRows = useMemo(() => {
    switch (attention) {
      case 'approved':
      case 'pending':
      case 'rejected':
        return ledgerRows.filter((row) => row.status === attention);
      case 'long-shift':
        return ledgerRows.filter((row) => row.kind === 'time' && longShiftKeys.has(`${row.employeeId}|${row.date}`));
      default:
        return ledgerRows;
    }
  }, [ledgerRows, attention, longShiftKeys]);

  const sortedRows = useMemo(() => {
    const rows = [...attentionRows];
    const direction = sortDirection === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const left = sortKey === 'amount' ? a.amount : String(a[sortKey] ?? '').toLowerCase();
      const right = sortKey === 'amount' ? b.amount : String(b[sortKey] ?? '').toLowerCase();
      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });
    return rows;
  }, [attentionRows, sortKey, sortDirection]);

  const previewRows = useMemo(() => sortedRows.slice(0, visibleRows), [sortedRows, visibleRows]);

  // A new scope is a new ledger; paging and any check filter start over.
  useEffect(() => {
    setVisibleRows(PREVIEW_PAGE);
  }, [scope, selectedEmployee, selectedUnit, activeOnly, filters, attention]);

  /* ── Export dock ─────────────────────────────────────────────────── */

  /** What 02 · People resolves to in a filename. */
  const exportScopeName = useMemo(() => {
    if (selectedEmployee !== 'all') {
      const employee = employeeById.get(String(selectedEmployee));
      return employee ? getDemoEmployeeName(employee, t) : t('reports.employee', 'Employee');
    }
    if (selectedUnit !== 'all') return translateDepartment(selectedUnit);
    return t('reports.allEmployees', 'All Employees');
  }, [selectedEmployee, selectedUnit, employeeById, t]);

  /** One-person reports: "Name · Position". Roster/unit reports stay a group label. */
  const describeExportSubject = useCallback((employees, separator = '·') => {
    if (selectedEmployee === 'all') return exportScopeName;
    const employee = (employees || []).find((emp) => String(emp.id) === String(selectedEmployee));
    if (!employee) return exportScopeName;
    const name = isDemoMode() ? getDemoEmployeeName(employee, t) : (employee.name || exportScopeName);
    const position = translatePosition(employee.position);
    return position ? `${name} ${separator} ${position}` : name;
  }, [selectedEmployee, exportScopeName, t]);

  /**
   * The one filename builder. The dock prints what the export writes because
   * both call this — the three writers no longer each spell it out.
   */
  const buildExportFilename = useCallback((extension) => {
    const safe = (value, fallback) => {
      const text = String(value ?? '').trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
      return text || fallback;
    };
    const prefix = safe(t('reports.filenamePrefix', 'HR_Report_'), 'HR_Report').replace(/_+$/, '');
    return `${prefix}_${safe(exportScopeName, 'All_Employees')}_${filters.startDate}_to_${filters.endDate}_${currentLanguage.toUpperCase()}.${extension}`;
  }, [exportScopeName, filters.startDate, filters.endDate, currentLanguage, t]);

  /**
   * CSV size, measured off the fields the CSV writer actually emits for a
   * sample of the records in hand — not a constant per row, because a task
   * description weighs many times what a punch does. XLSX compresses and PDF
   * paginates, so neither gets an estimate.
   */
  const estimatedCsvBytes = useMemo(() => {
    if (totals.rows === 0) return 0;

    const SAMPLE = 25;
    const HEADER_AND_METADATA_BYTES = 700;

    const sizeOf = (records, fieldsOf) => {
      if (records.length === 0) return 0;
      const sample = records.slice(0, SAMPLE);
      const bytes = sample.reduce((sum, record) => {
        const line = fieldsOf(record).map((field) => String(field ?? '')).join(',');
        // UTF-8: Vietnamese and CJK cost more than one byte a character.
        return sum + new Blob([`${line}\r\n`]).size;
      }, 0);
      return Math.round((bytes / sample.length) * records.length);
    };

    return HEADER_AND_METADATA_BYTES
      + sizeOf(scopedData.timeEntries, (entry) => [
        entry.employee?.name, entry.employee?.department, entry.employee?.position, entry.date,
        entry.clock_in, entry.clock_out, entry.hours, entry.hour_type, entry.status, entry.notes, entry.created_at,
      ])
      + sizeOf(scopedData.tasks, (task) => [
        task.employee?.name, task.employee?.department, task.title, task.description, task.priority,
        task.status, task.due_date, task.created_at, task.updated_at,
      ])
      + sizeOf(scopedData.goals, (goal) => [
        goal.employee?.name, goal.employee?.department, goal.title, goal.description, goal.category,
        goal.status, goal.progress, goal.target_date, goal.notes, goal.created_at, goal.updated_at,
      ])
      + sizeOf(scopedData.leave, (request) => [
        request.employee?.name, request.employee?.department, request.leave_type,
        request.start_date, request.end_date, request.days_count, request.status, request.reason, request.created_at,
      ]);
  }, [scopedData, totals.rows]);

  const rememberExport = useCallback((filename, rows) => {
    const entry = {
      filename,
      rows,
      at: new Date().toISOString(),
      by: user?.name || user?.user_metadata?.name || user?.email || '',
    };
    setLastExport(entry);
    try {
      window.localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(entry));
    } catch {
      /* private browsing — the header simply keeps the previous line */
    }
  }, [user]);

  // The column menu is a popover: anything outside it closes it.
  useEffect(() => {
    if (!columnMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [columnMenuOpen]);

  // Escape closes whichever of the two overlays is open.
  useEffect(() => {
    if (!columnMenuOpen && !peopleListOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setColumnMenuOpen(false);
      setPeopleListOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [columnMenuOpen, peopleListOpen]);

  const buildTimeEntryCsvRows = (timeEntries, ugcMap = null) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Name'),
      t('employees.department', 'Department'),
      t('employees.position', 'Position'),
      t('timeTracking.date', 'Date'),
      t('timeTracking.clockIn', 'Clock In'),
      t('timeTracking.clockOut', 'Clock Out'),
      t('timeTracking.amountHours', 'Hours'),
      t('timeTracking.hourType', 'Hour Type'),
      t('common.status', 'Status'),
      t('timeTracking.notes', 'Notes'),
      t('timeTracking.createdAt', 'Created At')
    ];

    const rows = timeEntries.map((entry) => [
      t('reports.timeEntries', 'Time Entries'),
      isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || 'Unknown'),
      translateDepartment(entry.employee?.department) || '',
      translatePosition(entry.employee?.position) || '',
      entry.date,
      entry.clock_in || '',
      entry.clock_out || '',
      entry.hours ? formatHours(entry.hours) : '0.0',
      translateHourType(entry.hour_type) || '',
      translateStatus(entry.status) || '',
      translateNotes(entry.notes, ugcMap) || '',
      new Date(entry.created_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const buildTaskCsvRows = (tasks, ugcMap = null) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Name'),
      t('employees.department', 'Department'),
      t('reports.excel.headers.taskTitle', 'Task Title'),
      t('reports.excel.headers.description', 'Description'),
      t('reports.excel.headers.priority', 'Priority'),
      t('reports.excel.headers.status', 'Status'),
      t('taskListing.startDate', 'Start Date'),
      t('reports.excel.headers.dueDate', 'Due Date'),
      t('taskListing.completionDate', 'Completion Date'),
      t('reports.excel.headers.estimatedHours', 'Estimated Days'),
      t('reports.excel.headers.actualHours', 'Actual Days'),
      t('reports.excel.headers.variance', 'Variance'),
      t('reports.excel.headers.createdAt', 'Created At'),
      t('reports.excel.headers.updatedAt', 'Updated At')
    ];

    const rows = tasks.map((task) => {
      const duration = getTaskDurationDays(task);
      return [
        t('reports.tasks', 'Tasks'),
        isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || 'Unknown'),
        translateDepartment(task.employee?.department) || '',
        isDemoMode() ? getDemoTaskTitle(task, t) : mapUgc(ugcMap, task.title || ''),
        isDemoMode() ? getDemoTaskDescription(task, t) : mapUgc(ugcMap, task.description || ''),
        translatePriority(task.priority) || '',
        translateStatus(task.status) || '',
        task.start_date || '',
        task.due_date || '',
        task.completion_date || '',
        duration.estimated ?? '',
        duration.actual ?? '',
        duration.variance ?? '',
        new Date(task.created_at).toLocaleString(),
        new Date(task.updated_at).toLocaleString()
      ];
    });

    return { headers, rows };
  };

  const buildGoalCsvRows = (goals, ugcMap = null) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Name'),
      t('employees.department', 'Department'),
      t('reports.excel.headers.goalTitle', 'Goal Title'),
      t('reports.excel.headers.description', 'Description'),
      t('reports.excel.headers.category', 'Category'),
      t('reports.excel.headers.status', 'Status'),
      t('reports.excel.headers.progress', 'Progress (%)'),
      t('reports.excel.headers.targetDate', 'Target Date'),
      t('reports.excel.headers.notes', 'Notes'),
      t('reports.excel.headers.createdAt', 'Created At'),
      t('reports.excel.headers.updatedAt', 'Updated At')
    ];

    const rows = goals.map((goal) => [
      t('reports.personalGoals', 'Personal Goals'),
      isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || 'Unknown'),
      translateDepartment(goal.employee?.department) || '',
      isDemoMode() ? getDemoGoalTitle(goal, t) : mapUgc(ugcMap, goal.title || ''),
      isDemoMode() ? getDemoGoalDescription(goal, t) : mapUgc(ugcMap, goal.description || ''),
      translateCategory(goal.category) || '',
      translateStatus(goal.status) || '',
      goal.progress || 0,
      goal.target_date || '',
      mapUgc(ugcMap, goal.notes || ''),
      new Date(goal.created_at).toLocaleString(),
      new Date(goal.updated_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const buildLeaveCsvRows = (leaveRequests, ugcMap = null) => {
    const headers = [
      t('reports.excel.headers.dataType', 'Data Type'),
      t('employees.name', 'Name'),
      t('employees.department', 'Department'),
      t('reports.leaveType', 'Leave Type'),
      t('reports.dateRange', 'Date Range'),
      t('reports.days', 'Days'),
      t('reports.status', 'Status'),
      t('timeTracking.notes', 'Notes'),
      t('timeTracking.createdAt', 'Created At')
    ];

    const rows = leaveRequests.map((req) => [
      t('reports.leave', 'Leave Requests'),
      isDemoMode() ? getDemoEmployeeName(req.employee, t) : (req.employee?.name || 'Unknown'),
      translateDepartment(req.employee?.department) || '',
      translateLeaveType(req.leave_type),
      `${(req.start_date || '').slice(0, 10)} → ${(req.end_date || req.start_date || '').slice(0, 10)}`,
      req.days_count ?? '',
      translateStatus(req.status) || '',
      mapUgc(ugcMap, req.reason || ''),
      new Date(req.created_at).toLocaleString()
    ]);

    return { headers, rows };
  };

  const exportAllToCSV = async () => {
    setExporting(true);
    try {
      const exportData = await getFilteredExportData();
      // `employees` is already the 02 · People cohort — unit, active-only and
      // single-person selection are resolved before the snapshot gets here.
      const { timeEntries, tasks, goals, leave, employees } = exportData;
      const exportStats = computeExportStats(timeEntries, tasks, goals, leave);

      if (exportStats.totalRecords === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const ugcMap = await buildUgcTranslateMap(
        collectExportUgcStrings(timeEntries, tasks, goals, leave)
      );

      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';

      const metadataRows = [
        `"${t('reports.performanceReport', 'HR PERFORMANCE REPORT')}"`,
        `"${t('reports.language', 'Report Language')}: ${languageName}"`,
        `"${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}"`,
        `"${t('reports.period', 'Period')}: ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}"`,
        `"${t('employees.name', 'Name')}:- ${describeExportSubject(employees)}"`
      ];

      const sections = [{
        title: t('reports.summaryOverview', 'SUMMARY OVERVIEW'),
        headers: [t('reports.excel.performance.tableHeaders.metric', 'Metric'), t('reports.excel.performance.tableHeaders.value', 'Value')],
        rows: [
          [t('reports.totalRecords', 'Total Records'), exportStats.totalRecords],
          [t('reports.timeEntries', 'Time Entries'), exportStats.timeEntriesCount],
          [t('reports.tasks', 'Tasks'), exportStats.tasksCount],
          [t('reports.goals', 'Goals'), exportStats.goalsCount],
          ...(scope.leave ? [[t('reports.leave', 'Leave Requests'), exportStats.leaveCount]] : []),
          [t('reports.totalHours', 'Total Hours'), `${exportStats.totalHours}h`],
          [t('reports.approved', 'Approved'), exportStats.approvedTime],
          [t('reports.completedTasks', 'Completed Tasks'), exportStats.completedTasks],
          [t('reports.achievedGoals', 'Achieved Goals'), exportStats.achievedGoals]
        ]
      }];

      if (timeEntries.length > 0) {
        const timeSection = buildTimeEntryCsvRows(timeEntries, ugcMap);
        sections.push({ title: t('reports.timeEntries', 'TIME ENTRIES').toUpperCase(), ...timeSection });
      }
      if (tasks.length > 0) {
        const taskSection = buildTaskCsvRows(tasks, ugcMap);
        sections.push({ title: t('reports.tasks', 'TASKS').toUpperCase(), ...taskSection });
      }
      if (goals.length > 0) {
        const goalSection = buildGoalCsvRows(goals, ugcMap);
        sections.push({ title: t('reports.personalGoals', 'PERSONAL GOALS').toUpperCase(), ...goalSection });
      }
      if (leave.length > 0) {
        const leaveSection = buildLeaveCsvRows(leave, ugcMap);
        sections.push({ title: t('reports.leave', 'LEAVE REQUESTS').toUpperCase(), ...leaveSection });
      }

      if (selectedEmployee !== 'all') {
        const employee = employees.find((emp) => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
          sections.push({
            title: t('reports.excel.performance.header', 'EMPLOYEE PERFORMANCE').toUpperCase(),
            headers: [
              t('reports.excel.performance.tableHeaders.metric', 'Metric'),
              t('reports.excel.performance.tableHeaders.value', 'Value')
            ],
            rows: [
              [t('reports.excel.performance.name', 'Name'), getDemoEmployeeName(employee, t)],
              [t('reports.excel.metrics.totalHours', 'Total Hours Logged'), performance.totalHours.toFixed(1)],
              [t('reports.excel.metrics.totalTasks', 'Total Tasks'), performance.tasksCount],
              [t('reports.excel.performance.taskCompletionRate', 'Task Completion Rate'), `${performance.taskCompletionRate}%`],
              [t('reports.excel.metrics.totalGoals', 'Total Goals'), performance.goalsCount],
              [t('reports.excel.performance.avgGoalProgress', 'Average Goal Progress'), `${performance.avgGoalProgress}%`],
              [t('reports.excel.performance.overallScore', 'Overall Performance Score:'), `${performance.overallScore}%`]
            ]
          });
        }
      } else if (employees.length > 0) {
        sections.push({
          title: t('reports.excel.sheets.allEmployeesOverview', 'ALL EMPLOYEES OVERVIEW').toUpperCase(),
          headers: [
            t('reports.excel.performance.name', 'Name'),
            t('reports.excel.performance.department', 'Department'),
            t('reports.excel.metrics.totalHours', 'Total Hours Logged'),
            t('reports.excel.metrics.totalTasks', 'Total Tasks'),
            t('reports.excel.metrics.completedTasks', 'Completed Tasks'),
            t('reports.excel.metrics.totalGoals', 'Total Goals'),
            t('reports.excel.performance.overallScore', 'Overall Score')
          ],
          rows: employees.map((employee) => {
            const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
            return [
              getDemoEmployeeName(employee, t),
              translateDepartment(employee.department),
              performance.totalHours.toFixed(1),
              performance.tasksCount,
              performance.completedTasks,
              performance.goalsCount,
              `${performance.overallScore}%`
            ];
          })
        });
      }

      const csvContent = buildCombinedCsvContent({ metadataRows, sections });
      const filename = buildExportFilename('csv');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      rememberExport(filename, exportStats.totalRecords);
      alert(t('reports.csvExportSuccess', 'CSV report exported successfully with all data types in one file!'));
    } catch (error) {
      console.error('Error exporting combined CSV:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('reports.errorExporting', 'Error exporting data'));
    } finally {
      setExporting(false);
    }
  };

  // Enhanced Excel Export with Metrics, Embedded Charts, and Styled Tables
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const exportSnapshot = await getFilteredExportData();
      const timeEntries = exportSnapshot.timeEntries;
      const tasks = exportSnapshot.tasks;
      const goals = exportSnapshot.goals;
      const leave = exportSnapshot.leave;
      const employees = exportSnapshot.employees;

      if (timeEntries.length === 0 && tasks.length === 0 && goals.length === 0 && leave.length === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const ugcMap = await buildUgcTranslateMap(
        collectExportUgcStrings(timeEntries, tasks, goals, leave)
      );

      // Helpers for safe values and typing
      const sanitize = (v) => {
        if (v == null) return '';
        const s = String(v);
        return (/^[=+\-@]/.test(s) ? "'" + s : s);
      };

      const toNumber = (n, fallback = 0) => {
        const num = Number(n);
        return Number.isFinite(num) ? num : fallback;
      };

      // Localized label helper
      const tr = (key, fallback) => t(key, fallback);

      const ExcelJS = await loadExcelJs();
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'HR Management System';
      workbook.created = new Date();

      const sheetNames = {
        summary: tr('reports.excel.sheets.summary', 'Summary'),
        performance: tr('reports.excel.sheets.performance', 'Employee Performance'),
        charts: tr('reports.excel.sheets.charts', 'Charts & Metrics'),
        timeEntries: tr('reports.excel.sheets.timeEntries', 'Time Entries'),
        tasks: tr('reports.excel.sheets.tasks', 'Tasks'),
        goals: tr('reports.excel.sheets.goals', 'Goals')
      };
      
      // Who the workbook is about: a person, a unit, or the whole roster.
      const employeeName = describeExportSubject(employees);

      // ==================== SUMMARY/METRICS SHEET WITH STYLING ====================
      const summarySheet = workbook.addWorksheet(sheetNames.summary, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      });
      
      // Header styling
      summarySheet.getCell('A1').value = tr('reports.excel.summaryTitle', 'HR Report Summary');
      summarySheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.mergeCells('A1:C1');
      summarySheet.getRow(1).height = 30;
      
      // Report Info
      let currentRow = 3;
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.generated', 'Generated');
      summarySheet.getCell(`B${currentRow}`).value = new Date().toLocaleString();
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.dateRange', 'Date Range');
      summarySheet.getCell(`B${currentRow}`).value = `${filters.startDate} ${tr('reports.to', 'to')} ${filters.endDate}`;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      summarySheet.getCell(`A${currentRow}`).value = `${tr('employees.name', 'Name')}:-`;
      summarySheet.getCell(`B${currentRow}`).value = employeeName;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      
      const languageName = SUPPORTED_LANGUAGES[currentLanguage]?.name || 'English';
      summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.reportLanguage', 'Report Language');
      summarySheet.getCell(`B${currentRow}`).value = languageName;
      summarySheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;

      summarySheet.getCell('C2').value = tr('reports.excel.visual', 'Visual');
      summarySheet.getCell('C2').font = { bold: true };
      summarySheet.getCell('C2').alignment = { horizontal: 'center' };
      
      // Time Entries Metrics with Styling
      if (timeEntries.length > 0) {
        const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        const regularHours = timeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
        // Include both overtime and bonus as overtime hours
        const overtimeHours = timeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
        const wfhHours = timeEntries.filter(e => e.hour_type === 'wfh').reduce((sum, e) => sum + (e.hours || 0), 0);
        const pendingEntries = timeEntries.filter(e => e.status === 'pending').length;
        const approvedEntries = timeEntries.filter(e => e.status === 'approved').length;
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.timeTracking', 'Time Tracking Summary');
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
        summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
        
        const timeBarRows = [];
        const addMetric = (label, value, isNumeric = false, trackBar = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          const numericValue = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`B${currentRow}`).value = numericValue;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          const barCell = summarySheet.getCell(`C${currentRow}`);
          barCell.value = isNumeric ? numericValue : '';
          if (trackBar && isNumeric) {
            timeBarRows.push(currentRow);
          }
          currentRow++;
        };

        addMetric(tr('reports.excel.metrics.totalTimeEntries', 'Total Time Entries'), timeEntries.length, true, true);
        addMetric(tr('reports.excel.metrics.totalHours', 'Total Hours Logged'), formatHours(totalHours), true, true);
        addMetric(tr('reports.excel.metrics.regularHours', 'Regular Hours'), formatHours(regularHours), true, true);
        addMetric(tr('reports.excel.metrics.overtimeHours', 'Overtime Hours'), formatHours(overtimeHours), true, true);
        addMetric(tr('reports.excel.metrics.wfhHours', 'WFH Hours'), formatHours(wfhHours), true, true);
        addMetric(tr('reports.excel.metrics.pendingApprovals', 'Pending Approvals'), pendingEntries, true, true);
        addMetric(tr('reports.excel.metrics.approvedEntries', 'Approved Entries'), approvedEntries, true, true);
        if (timeBarRows.length) {
          const start = Math.min(...timeBarRows);
          const end = Math.max(...timeBarRows);
          summarySheet.addConditionalFormatting({
            ref: `C${start}:C${end}`,
            rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: 'FF70AD47', showValue: false }]
          });
        }
        currentRow++;
      }
      
      // Tasks Metrics with Styling
      if (tasks.length > 0) {
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
        const highPriority = tasks.filter(t => t.priority === 'high').length;
        const { totalEstimated, totalActual } = tasks.reduce((sum, task) => {
          const duration = getTaskDurationDays(task);
          return {
            totalEstimated: sum.totalEstimated + (duration.estimated || 0),
            totalActual: sum.totalActual + (duration.actual || 0)
          };
        }, { totalEstimated: 0, totalActual: 0 });
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.workload', 'Workload Summary');
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
        summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
        
        const taskBarRows = [];
        const addMetric = (label, value, isNumeric = false, trackBar = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          const numericValue = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`B${currentRow}`).value = numericValue;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          const barCell = summarySheet.getCell(`C${currentRow}`);
          barCell.value = isNumeric ? numericValue : '';
          if (trackBar && isNumeric) {
            taskBarRows.push(currentRow);
          }
          currentRow++;
        };

        addMetric(tr('reports.excel.metrics.totalTasks', 'Total Tasks'), tasks.length, true, true);
        addMetric(tr('reports.excel.metrics.completedTasks', 'Completed Tasks'), completedTasks, true, true);
        addMetric(tr('reports.excel.metrics.inProgress', 'In Progress'), inProgressTasks, true, true);
        addMetric(tr('reports.excel.metrics.highPriorityTasks', 'High Priority Tasks'), highPriority, true, true);
        addMetric(tr('reports.excel.metrics.estimatedHours', 'Estimated Days'), totalEstimated, true, true);
        addMetric(tr('reports.excel.metrics.actualHours', 'Actual Days'), totalActual, true, true);
        addMetric(tr('reports.excel.metrics.variance', 'Variance'), totalActual - totalEstimated, true, true);
        if (taskBarRows.length) {
          const start = Math.min(...taskBarRows);
          const end = Math.max(...taskBarRows);
          summarySheet.addConditionalFormatting({
            ref: `C${start}:C${end}`,
            rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: 'FFFFC000', showValue: false }]
          });
        }
        currentRow++;
      }
      
      // Goals Metrics with Styling
      if (goals.length > 0) {
        const completedGoals = goals.filter(g => g.status === 'completed').length;
        const inProgressGoals = goals.filter(g => g.status === 'in_progress').length;
        const avgProgress = (goals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / goals.length).toFixed(1);
        
        // Section Header
        summarySheet.getCell(`A${currentRow}`).value = tr('reports.excel.goals', 'Goals Summary');
        summarySheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
        summarySheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow++;
        
        const goalBarRows = [];
        const addMetric = (label, value, isNumeric = false, trackBar = false) => {
          summarySheet.getCell(`A${currentRow}`).value = label;
          const numericValue = isNumeric ? toNumber(value) : sanitize(value);
          summarySheet.getCell(`B${currentRow}`).value = numericValue;
          summarySheet.getCell(`A${currentRow}`).font = { bold: true };
          summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'right' };
          const barCell = summarySheet.getCell(`C${currentRow}`);
          barCell.value = isNumeric ? numericValue : '';
          if (trackBar && isNumeric) {
            goalBarRows.push(currentRow);
          }
          currentRow++;
        };

        addMetric(tr('reports.excel.metrics.totalGoals', 'Total Goals'), goals.length, true, true);
        addMetric(tr('reports.excel.metrics.completedGoals', 'Completed Goals'), completedGoals, true, true);
        addMetric(tr('reports.excel.metrics.inProgress', 'In Progress'), inProgressGoals, true, true);
        addMetric(tr('reports.excel.metrics.avgProgress', 'Average Progress'), parseFloat(avgProgress) || 0, true, true);
        if (goalBarRows.length) {
          const start = Math.min(...goalBarRows);
          const end = Math.max(...goalBarRows);
          summarySheet.addConditionalFormatting({
            ref: `C${start}:C${end}`,
            rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: 'FF5B9BD5', showValue: false }]
          });
        }
      }

      // Set column widths for summary sheet
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 20;
      summarySheet.getColumn(3).width = 18;
      // Format second column for numbers (metrics)
      summarySheet.getColumn(2).numFmt = '#,##0.00';

      // ==================== INDIVIDUAL EMPLOYEE PERFORMANCE SHEET ====================
      if (selectedEmployee !== 'all') {
        const employee = employees.find(emp => String(emp.id) === String(selectedEmployee));
        if (employee) {
          const perfSheet = workbook.addWorksheet(sheetNames.performance);
          
          // Header
          const perfHeader = tr('reports.excel.performance.header', 'Performance Report');
          const employeeDisplayName = getDemoEmployeeName(employee, t);
          perfSheet.getCell('A1').value = `${employeeDisplayName} - ${perfHeader}`;
          perfSheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
          perfSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
          perfSheet.mergeCells('A1:D1');
          perfSheet.getRow(1).height = 35;
          
          let perfRow = 3;
          
          // Employee Info Section
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.employeeInfo', 'Employee Information');
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          const addInfo = (label, value) => {
            perfSheet.getCell(`A${perfRow}`).value = label;
            perfSheet.getCell(`B${perfRow}`).value = value;
            perfSheet.getCell(`A${perfRow}`).font = { bold: true };
            perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
            perfRow++;
          };
          
          addInfo(tr('reports.excel.performance.name', 'Name'), getDemoEmployeeName(employee, t));
          addInfo(tr('reports.excel.performance.department', 'Department'), translateDepartment(employee.department));
          addInfo(tr('reports.excel.performance.position', 'Position'), translatePosition(employee.position));
          addInfo(tr('reports.excel.performance.email', 'Email'), employee.email || 'N/A');
          addInfo(tr('reports.excel.performance.reportPeriod', 'Report Period'), `${filters.startDate} ${tr('reports.to', 'to')} ${filters.endDate}`);
          perfRow++;
          
          // Performance Metrics Section
          const employeeTimeEntries = timeEntries.filter(e => e.employee_id === employee.id);
          const employeeTasks = tasks.filter(t => t.employee_id === employee.id);
          const employeeGoals = goals.filter(g => g.employee_id === employee.id);
          
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.performanceMetrics', 'Performance Metrics');
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          // Metrics table header
          [
            tr('reports.excel.performance.tableHeaders.metric', 'Metric'),
            tr('reports.excel.performance.tableHeaders.value', 'Value'),
            tr('reports.excel.performance.tableHeaders.status', 'Status'),
            tr('reports.excel.performance.tableHeaders.notes', 'Notes')
          ].forEach((header, idx) => {
            const cell = perfSheet.getCell(perfRow, idx + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.alignment = { horizontal: 'center' };
          });
          perfRow++;
          
          // Time Tracking Metrics
          const totalHours = employeeTimeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          const regularHours = employeeTimeEntries.filter(e => e.hour_type === 'regular').reduce((sum, e) => sum + (e.hours || 0), 0);
          // Include both overtime and bonus as overtime hours
          const overtimeHours = employeeTimeEntries.filter(e => e.hour_type === 'overtime' || e.hour_type === 'bonus').reduce((sum, e) => sum + (e.hours || 0), 0);
          const wfhHours = employeeTimeEntries.filter(e => e.hour_type === 'wfh').reduce((sum, e) => sum + (e.hours || 0), 0);
          const approvedEntries = employeeTimeEntries.filter(e => e.status === 'approved').length;

          const perfLabels = {
            totalHours: tr('reports.excel.metrics.totalHours', 'Total Hours Logged'),
            regularHours: tr('reports.excel.metrics.regularHours', 'Regular Hours'),
            overtimeHours: tr('reports.excel.metrics.overtimeHours', 'Overtime Hours'),
            wfhHours: tr('reports.excel.metrics.wfhHours', 'WFH Hours'),
            approvalRate: tr('reports.excel.performance.approvalRate', 'Approval Rate'),
            totalTasks: tr('reports.excel.metrics.totalTasks', 'Total Tasks'),
            taskCompletionRate: tr('reports.excel.performance.taskCompletionRate', 'Task Completion Rate'),
            totalGoals: tr('reports.excel.metrics.totalGoals', 'Total Goals'),
            avgGoalProgress: tr('reports.excel.performance.avgGoalProgress', 'Average Goal Progress'),
            entries: tr('reports.excel.entries', 'entries'),
            ofTotal: tr('reports.excel.ofTotal', 'of total'),
            completed: tr('reports.excel.completedShort', 'completed')
          };

          const statusLabels = {
            high: tr('reports.excel.status.high', 'High'),
            normal: tr('reports.excel.status.normal', 'Normal'),
            tracked: tr('reports.excel.status.tracked', 'Tracked'),
            pending: tr('reports.excel.status.pending', 'Pending'),
            allApproved: tr('reports.excel.status.allApproved', 'All Approved'),
            active: tr('reports.excel.status.active', 'Active'),
            noTasks: tr('reports.excel.status.noTasks', 'No Tasks'),
            excellent: tr('reports.excel.status.excellent', 'Excellent'),
            good: tr('reports.excel.status.good', 'Good'),
            needsImprovement: tr('reports.excel.status.needsImprovement', 'Needs Improvement'),
            set: tr('reports.excel.status.set', 'Set'),
            onTrack: tr('reports.excel.status.onTrack', 'On Track'),
            progressing: tr('reports.excel.status.progressing', 'Progressing'),
            behind: tr('reports.excel.status.behind', 'Behind')
          };
          
          const addMetric = (metric, value, status, notes) => {
            perfSheet.getCell(`A${perfRow}`).value = metric;
            perfSheet.getCell(`B${perfRow}`).value = value;
            perfSheet.getCell(`C${perfRow}`).value = status;
            perfSheet.getCell(`D${perfRow}`).value = notes;
            perfSheet.getCell(`B${perfRow}`).alignment = { horizontal: 'right' };
            perfRow++;
          };
          const entriesCountLabel = `${employeeTimeEntries.length} ${perfLabels.entries}`;
          const totalHoursDenominator = totalHours > 0 ? totalHours : 1;
          const approvalPercent = employeeTimeEntries.length > 0 ? ((approvedEntries / employeeTimeEntries.length) * 100).toFixed(0) : '0';
          
          addMetric(
            perfLabels.totalHours,
            totalHours.toFixed(1),
            totalHours > 160 ? `⚠️ ${statusLabels.high}` : `✅ ${statusLabels.normal}`,
            entriesCountLabel
          );
          addMetric(
            perfLabels.regularHours,
            regularHours.toFixed(1),
            `✅ ${statusLabels.tracked}`,
            `${((regularHours / totalHoursDenominator) * 100).toFixed(0)}% ${perfLabels.ofTotal}`
          );
          addMetric(
            perfLabels.overtimeHours,
            overtimeHours.toFixed(1),
            overtimeHours > 20 ? `⚠️ ${statusLabels.high}` : `✅ ${statusLabels.normal}`,
            `${((overtimeHours / totalHoursDenominator) * 100).toFixed(0)}% ${perfLabels.ofTotal}`
          );
          addMetric(
            perfLabels.wfhHours,
            wfhHours.toFixed(1),
            `✅ ${statusLabels.tracked}`,
            `${totalHours > 0 ? (wfhHours / totalHours * 100).toFixed(0) : 0}% ${perfLabels.ofTotal}`
          );
          addMetric(
            perfLabels.approvalRate,
            `${approvedEntries}/${employeeTimeEntries.length}`,
            approvedEntries === employeeTimeEntries.length ? `✅ ${statusLabels.allApproved}` : `⏳ ${statusLabels.pending}`,
            `${approvalPercent}%`
          );
          perfRow++;
          
          // Task Performance
          const completedTasks = employeeTasks.filter(t => t.status === 'completed').length;
          const taskCompletionRate = employeeTasks.length > 0 ? ((completedTasks / employeeTasks.length) * 100).toFixed(1) : 0;
          
          addMetric(
            perfLabels.totalTasks,
            employeeTasks.length,
            employeeTasks.length > 0 ? `✅ ${statusLabels.active}` : `⚠️ ${statusLabels.noTasks}`,
            `${completedTasks} ${perfLabels.completed}`
          );
          addMetric(
            perfLabels.taskCompletionRate,
            `${taskCompletionRate}%`,
            taskCompletionRate >= 80 ? `✅ ${statusLabels.excellent}` : taskCompletionRate >= 60 ? `⚠️ ${statusLabels.good}` : `❌ ${statusLabels.needsImprovement}`,
            `${completedTasks}/${employeeTasks.length} ${perfLabels.completed}`
          );
          perfRow++;
          
          // Goals Performance
          const completedGoals = employeeGoals.filter(g => g.status === 'completed').length;
          const avgProgress = employeeGoals.length > 0 ? (employeeGoals.reduce((sum, g) => sum + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / employeeGoals.length).toFixed(1) : 0;
          
          addMetric(
            perfLabels.totalGoals,
            employeeGoals.length,
            employeeGoals.length > 0 ? `✅ ${statusLabels.set}` : `⚠️ ${statusLabels.noTasks}`,
            `${completedGoals} ${perfLabels.completed}`
          );
          addMetric(
            perfLabels.avgGoalProgress,
            `${avgProgress}%`,
            avgProgress >= 75 ? `✅ ${statusLabels.onTrack}` : avgProgress >= 50 ? `⚠️ ${statusLabels.progressing}` : `❌ ${statusLabels.behind}`,
            `${employeeGoals.length} ${tr('reports.goals', 'Goals')} ${statusLabels.tracked}`
          );
          perfRow += 2;
          
          // Performance Summary
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.overallRating', 'Overall Performance Rating');
          perfSheet.getCell(`A${perfRow}`).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          perfSheet.getCell(`A${perfRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          perfSheet.mergeCells(`A${perfRow}:D${perfRow}`);
          perfRow++;
          
          // Calculate overall score
          const timeScore = Math.min(100, (approvedEntries / Math.max(1, employeeTimeEntries.length)) * 100);
          const taskScore = parseFloat(taskCompletionRate);
          const goalScore = parseFloat(avgProgress);
          const overallScore = ((timeScore + taskScore + goalScore) / 3).toFixed(1);
          
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.overallScore', 'Overall Performance Score:');
          perfSheet.getCell(`B${perfRow}`).value = `${overallScore}%`;
          perfSheet.getCell(`A${perfRow}`).font = { bold: true, size: 14 };
          perfSheet.getCell(`B${perfRow}`).font = { bold: true, size: 16, color: { argb: overallScore >= 80 ? 'FF00B050' : overallScore >= 60 ? 'FFFFC000' : 'FFFF0000' } };
          perfSheet.getCell(`B${perfRow}`).alignment = { horizontal: 'center' };
          perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
          perfRow++;
          
          perfSheet.getCell(`A${perfRow}`).value = tr('reports.excel.performance.ratingLabel', 'Rating:');
          const rating = overallScore >= 90
            ? `⭐⭐⭐⭐⭐ ${tr('reports.excel.rating.outstanding', 'Outstanding')}`
            : overallScore >= 80
            ? `⭐⭐⭐⭐ ${tr('reports.excel.rating.excellent', 'Excellent')}`
            : overallScore >= 70
            ? `⭐⭐⭐ ${tr('reports.excel.rating.good', 'Good')}`
            : overallScore >= 60
            ? `⭐⭐ ${tr('reports.excel.rating.satisfactory', 'Satisfactory')}`
            : `⭐ ${tr('reports.excel.rating.needsImprovement', 'Needs Improvement')}`;
          perfSheet.getCell(`B${perfRow}`).value = rating;
          perfSheet.getCell(`A${perfRow}`).font = { bold: true };
          perfSheet.getCell(`B${perfRow}`).font = { bold: true, size: 12 };
          perfSheet.mergeCells(`B${perfRow}:D${perfRow}`);
          
          // Set column widths
          perfSheet.columns = [
            { width: 25 }, { width: 20 }, { width: 20 }, { width: 30 }
          ];
        }
      }

      if (selectedEmployee === 'all' && employees.length > 0) {
        const overviewSheet = workbook.addWorksheet(tr('reports.excel.sheets.allEmployeesOverview', 'All Employees Overview'));
        const overviewHeaders = [
          tr('reports.excel.performance.name', 'Name'),
          tr('reports.excel.performance.department', 'Department'),
          tr('reports.excel.performance.position', 'Position'),
          tr('reports.excel.metrics.totalHours', 'Total Hours Logged'),
          tr('reports.excel.metrics.totalTasks', 'Total Tasks'),
          tr('reports.excel.metrics.completedTasks', 'Completed Tasks'),
          tr('reports.excel.metrics.totalGoals', 'Total Goals'),
          tr('reports.excel.performance.avgGoalProgress', 'Average Goal Progress'),
          tr('reports.excel.performance.overallScore', 'Overall Score')
        ];

        overviewHeaders.forEach((header, idx) => {
          const cell = overviewSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        employees.forEach((employee, idx) => {
          const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
          const rowNum = idx + 2;
          const rowData = [
            getDemoEmployeeName(employee, t),
            translateDepartment(employee.department),
            translatePosition(employee.position),
            Number(performance.totalHours.toFixed(1)),
            performance.tasksCount,
            performance.completedTasks,
            performance.goalsCount,
            Number(performance.avgGoalProgress),
            Number(performance.overallScore)
          ];

          rowData.forEach((value, colIdx) => {
            const cell = overviewSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            if (colIdx >= 3) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
            }
          });
        });

        overviewSheet.columns = [
          { width: 22 }, { width: 16 }, { width: 16 }, { width: 14 },
          { width: 12 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 }
        ];
        overviewSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== CHARTS SHEET WITH DATA ====================
      if (timeEntries.length > 0 || tasks.length > 0 || goals.length > 0) {
        const chartsSheet = workbook.addWorksheet(sheetNames.charts);
        
        let chartRow = 1;
        
        // Hours by Type Chart Data
        if (timeEntries.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.hoursByType', 'Hours by Type').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.type', 'Type');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.hours', 'Hours');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          chartRow++;
          
          const hoursByType = {};
          timeEntries.forEach(entry => {
            const type = entry.hour_type || 'unknown';
            hoursByType[type] = (hoursByType[type] || 0) + (entry.hours || 0);
          });
          
          Object.entries(hoursByType).forEach(([type, hours]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateHourType(type) || type;
            chartsSheet.getCell(`B${chartRow}`).value = parseFloat(hours.toFixed(2));
            chartRow++;
          });
          chartRow += 2;
          
          // Status Distribution
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.statusDistribution', 'Status Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.status', 'Status');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          chartRow++;
          
          const statusCounts = {};
          timeEntries.forEach(entry => {
            const status = entry.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          
          Object.entries(statusCounts).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateStatus(status) || status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
        }
        
        // Task Metrics
        if (tasks.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.taskStatusDistribution', 'Task Status Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.status', 'Status');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
          chartRow++;
          
          const taskStatus = {};
          tasks.forEach(task => {
            const status = task.status || 'unknown';
            taskStatus[status] = (taskStatus[status] || 0) + 1;
          });
          
          Object.entries(taskStatus).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateStatus(status) || status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
          
          // Task Priority
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.taskPriorityDistribution', 'Task Priority Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;
          
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.priority', 'Priority');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4B084' } };
          chartRow++;
          
          const taskPriority = {};
          tasks.forEach(task => {
            const priority = task.priority || 'unknown';
            taskPriority[priority] = (taskPriority[priority] || 0) + 1;
          });
          
          Object.entries(taskPriority).forEach(([priority, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translatePriority(priority) || priority;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;
        }

        if (goals.length > 0) {
          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.goalStatusDistribution', 'Goal Status Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;

          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.status', 'Status');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
          chartRow++;

          Object.entries(aggregateCounts(goals, 'status')).forEach(([status, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateStatus(status) || status;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
          chartRow += 2;

          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.charts.goalCategoryDistribution', 'Goal Category Distribution').toUpperCase();
          chartsSheet.getCell(`A${chartRow}`).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          chartsSheet.getCell(`A${chartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8064A2' } };
          chartsSheet.mergeCells(`A${chartRow}:B${chartRow}`);
          chartRow++;

          chartsSheet.getCell(`A${chartRow}`).value = tr('reports.excel.headers.category', 'Category');
          chartsSheet.getCell(`B${chartRow}`).value = tr('reports.excel.headers.count', 'Count');
          chartsSheet.getRow(chartRow).font = { bold: true };
          chartsSheet.getRow(chartRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4DFEC' } };
          chartRow++;

          Object.entries(aggregateCounts(goals, 'category')).forEach(([category, count]) => {
            chartsSheet.getCell(`A${chartRow}`).value = translateCategory(category) || category;
            chartsSheet.getCell(`B${chartRow}`).value = count;
            chartRow++;
          });
        }
        
        // Set column widths
        chartsSheet.getColumn(1).width = 25;
        chartsSheet.getColumn(2).width = 15;
      }

      // ==================== TIME ENTRIES SHEET WITH STYLING ====================
      if (timeEntries.length > 0) {
        const timeEntriesSheet = workbook.addWorksheet(sheetNames.timeEntries);
        
        // Headers
        const headers = [
          tr('reports.excel.headers.employee', 'Employee'),
          tr('reports.excel.headers.department', 'Department'),
          tr('reports.excel.headers.position', 'Position'),
          tr('reports.excel.headers.date', 'Date'),
          tr('reports.excel.headers.clockIn', 'Clock In'),
          tr('reports.excel.headers.clockOut', 'Clock Out'),
          tr('reports.excel.headers.hours', 'Hours'),
          tr('reports.excel.headers.hourType', 'Hour Type'),
          tr('reports.excel.headers.status', 'Status'),
          tr('reports.excel.headers.notes', 'Notes'),
          tr('reports.excel.headers.createdAt', 'Created At')
        ];
        headers.forEach((header, idx) => {
          const cell = timeEntriesSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with alternating colors
        timeEntries.forEach((entry, idx) => {
          const rowNum = idx + 2;
          const rowData = [
            isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || 'Unknown'),
            translateDepartment(entry.employee?.department) || '',
            translatePosition(entry.employee?.position) || '',
            entry.date,
            entry.clock_in || '',
            entry.clock_out || '',
            entry.hours ? Number(formatHours(entry.hours)) : 0,
            translateHourType(entry.hour_type) || '',
            translateStatus(entry.status) || '',
            translateNotes(entry.notes, ugcMap) || '',
            new Date(entry.created_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = timeEntriesSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            // Center align specific columns: Date(4), Clock In(5), Clock Out(6), Hours(7), Hour Type(8), Status(9)
            if ([3, 4, 5, 6, 7, 8].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            }
          });
        });
        
        // Set column widths
        timeEntriesSheet.columns = [
          { width: 20 }, { width: 15 }, { width: 15 }, { width: 12 },
          { width: 10 }, { width: 10 }, { width: 8 }, { width: 12 },
          { width: 12 }, { width: 30 }, { width: 20 }
        ];
        
        // Freeze header row
        timeEntriesSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== TASKS SHEET WITH STYLING ====================
      if (tasks.length > 0) {
        const tasksSheet = workbook.addWorksheet(sheetNames.tasks);
        
        // Headers
        const headers = [
          tr('reports.excel.headers.employee', 'Employee'),
          tr('reports.excel.headers.department', 'Department'),
          tr('reports.excel.headers.taskTitle', 'Task Title'),
          tr('reports.excel.headers.description', 'Description'),
          tr('reports.excel.headers.priority', 'Priority'),
          tr('reports.excel.headers.status', 'Status'),
          tr('taskListing.startDate', 'Start Date'),
          tr('reports.excel.headers.dueDate', 'Due Date'),
          tr('taskListing.completionDate', 'Completion Date'),
          tr('reports.excel.headers.estimatedHours', 'Estimated Days'),
          tr('reports.excel.headers.actualHours', 'Actual Days'),
          tr('reports.excel.headers.variance', 'Variance'),
          tr('reports.excel.headers.createdAt', 'Created At'),
          tr('reports.excel.headers.updatedAt', 'Updated At')
        ];
        headers.forEach((header, idx) => {
          const cell = tasksSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with conditional formatting
        tasks.forEach((task, idx) => {
          const rowNum = idx + 2;
          const duration = getTaskDurationDays(task);
          const variance = duration.variance;
          const rowData = [
            isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || 'Unknown'),
            translateDepartment(task.employee?.department) || '',
            isDemoMode() ? getDemoTaskTitle(task, t) : mapUgc(ugcMap, task.title || ''),
            isDemoMode() ? getDemoTaskDescription(task, t) : mapUgc(ugcMap, task.description || ''),
            translatePriority(task.priority) || '',
            translateStatus(task.status) || '',
            task.start_date || '',
            task.due_date || '',
            task.completion_date || '',
            duration.estimated ?? '',
            duration.actual ?? '',
            variance ?? '',
            new Date(task.created_at).toLocaleString(),
            new Date(task.updated_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = tasksSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
            if ([4, 5, 6, 7, 8, 9, 10, 11, 12].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFF0' } };
            }
            
            if (colIdx === 11 && variance != null) {
              if (variance > 0) {
                cell.font = { color: { argb: 'FFFF0000' } }; // Red for over
              } else if (variance < 0) {
                cell.font = { color: { argb: 'FF00B050' } }; // Green for under
              }
            }
          });
        });
        
        // Set column widths
        tasksSheet.columns = [
          { width: 20 }, { width: 15 }, { width: 25 }, { width: 35 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 20 }
        ];
        
        // Freeze header row
        tasksSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // ==================== GOALS SHEET WITH STYLING ====================
      if (goals.length > 0) {
        const goalsSheet = workbook.addWorksheet(sheetNames.goals);
        
        // Headers
        const headers = [
          tr('reports.excel.headers.employee', 'Employee'),
          tr('reports.excel.headers.department', 'Department'),
          tr('reports.excel.headers.goalTitle', 'Goal Title'),
          tr('reports.excel.headers.description', 'Description'),
          tr('reports.excel.headers.category', 'Category'),
          tr('reports.excel.headers.status', 'Status'),
          tr('reports.excel.headers.progress', 'Progress (%)'),
          tr('reports.excel.headers.targetDate', 'Target Date'),
          tr('reports.excel.headers.notes', 'Notes'),
          tr('reports.excel.headers.createdAt', 'Created At'),
          tr('reports.excel.headers.updatedAt', 'Updated At')
        ];
        headers.forEach((header, idx) => {
          const cell = goalsSheet.getCell(1, idx + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        // Data rows with progress bar visualization
        goals.forEach((goal, idx) => {
          const rowNum = idx + 2;
          const rowData = [
            isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || 'Unknown'),
            translateDepartment(goal.employee?.department) || '',
            isDemoMode() ? getDemoGoalTitle(goal, t) : mapUgc(ugcMap, goal.title || ''),
            isDemoMode() ? getDemoGoalDescription(goal, t) : mapUgc(ugcMap, goal.description || ''),
            translateCategory(goal.category) || '',
            translateStatus(goal.status) || '',
            goal.progress || 0,
            goal.target_date || '',
            mapUgc(ugcMap, goal.notes || ''),
            new Date(goal.created_at).toLocaleString(),
            new Date(goal.updated_at).toLocaleString()
          ];
          
          rowData.forEach((value, colIdx) => {
            const cell = goalsSheet.getCell(rowNum, colIdx + 1);
            cell.value = value;
            
            // Center align specific columns: Category(5), Status(6), Progress(7), Target Date(8)
            if ([4, 5, 6, 7].includes(colIdx)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            // Alternating row colors
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F3FF' } };
            }
            
            // Color code progress column
            if (colIdx === 6) { // Progress column
              const progress = goal.progress || 0;
              if (progress === 100) {
                cell.font = { bold: true, color: { argb: 'FF00B050' } };
              } else if (progress >= 75) {
                cell.font = { bold: true, color: { argb: 'FF92D050' } };
              } else if (progress >= 50) {
                cell.font = { bold: true, color: { argb: 'FFFFC000' } };
              } else if (progress >= 25) {
                cell.font = { bold: true, color: { argb: 'FFFF6600' } };
              } else {
                cell.font = { bold: true, color: { argb: 'FFFF0000' } };
              }
            }
          });
        });
        
        // Set column widths
        goalsSheet.columns = [
          { width: 20 }, { width: 15 }, { width: 25 }, { width: 35 },
          { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 },
          { width: 30 }, { width: 20 }, { width: 20 }
        ];
        
        // Freeze header row
        goalsSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      }

      // Write the file with ExcelJS. The name comes from the same builder the
      // dock prints, so the two can never drift apart.
      const filename = buildExportFilename('xlsx');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      rememberExport(filename, timeEntries.length + tasks.length + goals.length + leave.length);
      alert(t('reports.exportSuccess', 'Excel report exported successfully with styled tables, metrics, and chart data!'));
    } catch (error) {
      console.error('Error exporting Excel:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('reports.errorExporting', 'Error exporting Excel file'));
    } finally {
      setExporting(false);
    }
  };

  const cleanTextForPDF = (text, unicodeFont = false) => {
    if (!text) return '';
    
    if (unicodeFont) {
      let cleaned = String(text)
        .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned || 'N/A';
    }

    const charMap = {
      // Vietnamese lowercase
      'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
      'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
      'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
      'đ': 'd',
      'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
      'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
      'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
      'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
      'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
      'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
      'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
      'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
      'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
      // Vietnamese uppercase
      'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
      'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
      'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
      'Đ': 'D',
      'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
      'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
      'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
      'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
      'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
      'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
      'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
      'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
      // German umlauts
      'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
      'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
      // Spanish
      'ñ': 'n', 'Ñ': 'N',
      // French
      'ç': 'c', 'Ç': 'C',
      'œ': 'oe', 'Œ': 'OE',
      'æ': 'ae', 'Æ': 'AE',
      // Additional accented characters
      'å': 'a', 'Å': 'A',
      'ë': 'e', 'Ë': 'E',
      'ï': 'i', 'Ï': 'I',
      'î': 'i', 'Î': 'I',
      'ø': 'o', 'Ø': 'O',
      'û': 'u', 'Û': 'U',
      'ÿ': 'y', 'Ÿ': 'Y'
    };
    
    let cleaned = String(text);
    
    cleaned = cleaned.split('').map(char => charMap[char] || char).join('');
    
    cleaned = cleaned.normalize('NFD');
    
    cleaned = cleaned.replace(/[\u0300-\u036f]/g, '');
    
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, (match) => {
      if (charMap[match]) return charMap[match];
      const base = match.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return base !== match ? base : '?';
    });
    
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
    
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned || 'N/A';
  };

  const mapUgc = (ugcMap, text) => {
    if (!text) return '';
    return ugcMap?.get(text) ?? text;
  };

  const collectExportUgcStrings = (timeEntries = [], tasks = [], goals = [], leave = []) => {
    const strings = [];
    const pushNotesBody = (notes) => {
      if (!notes) return;
      const match = String(notes).match(/^Entered by admin:?\s*/i);
      strings.push(match ? notes.slice(match[0].length) : notes);
    };
    timeEntries.forEach((entry) => pushNotesBody(entry.notes));
    if (!isDemoMode()) {
      tasks.forEach((task) => {
        if (task.title) strings.push(task.title);
        if (task.description) strings.push(task.description);
      });
      goals.forEach((goal) => {
        if (goal.title) strings.push(goal.title);
        if (goal.description) strings.push(goal.description);
        if (goal.notes) strings.push(goal.notes);
      });
    }
    leave.forEach((req) => {
      if (req.reason) strings.push(req.reason);
    });
    return strings;
  };

  /**
   * Pre-translates every unique UGC string in an export with the on-device
   * translator. Cache-first, so anything already seen on screen costs nothing;
   * the rest are translated one by one before the file is written.
   */
  const buildUgcTranslateMap = async (strings) => {
    const unique = [...new Set(strings.filter((s) => typeof s === 'string' && s.trim()))];
    if (unique.length === 0) return new Map();
    const translated = await translateTexts(unique, currentLanguage);
    return new Map(unique.map((s, i) => [s, translated[i] ?? s]));
  };

  // PDF Export with Charts and Tables
  const exportToPDF = async function() {
    setExporting(true);
    try {
      const exportSnapshot = await getFilteredExportData();
      const timeEntries = exportSnapshot.timeEntries;
      const tasks = exportSnapshot.tasks;
      const goals = exportSnapshot.goals;
      const leave = exportSnapshot.leave;
      const employees = exportSnapshot.employees;
      const exportStats = computeExportStats(timeEntries, tasks, goals, leave);

      if (exportStats.totalRecords === 0) {
        alert(t('reports.noData', 'No data available for the selected period'));
        return;
      }

      const ugcMap = await buildUgcTranslateMap(
        collectExportUgcStrings(timeEntries, tasks, goals, leave)
      );

      const [{ jsPDF, autoTable }, companyLogo] = await Promise.all([
        loadPdfLibs(),
        loadPdfLogo()
      ]);
      const doc = new jsPDF('p', 'mm', 'a4');
      const loadedFonts = await loadPdfFonts(doc, currentLanguage);
      const unicodeFontLoaded = loadedFonts.unicodeReady;

      if (!unicodeFontLoaded && ['jp', 'kr', 'th', 'vn'].includes(currentLanguage)) {
        console.warn('Unicode fonts unavailable — PDF labels may not render correctly.');
      }

      // opts.bold uses the family's real bold face (Archivo, Helvetica). Scripts
      // whose face has no bold sibling — CJK, Thai, Cyrillic Noto — are stroked
      // instead, so bolding never swaps in a font with different glyph coverage.
      const drawText = (text, x, y, opts) => {
        const { bold = false, ...textOpts } = opts || {};
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        const chosen = choosePdfFont(cleaned, loadedFonts);
        const hasBoldFace = bold && (
          chosen === 'helvetica' || pdfFontSupportsBold(chosen, loadedFonts)
        );
        try {
          doc.setFont(chosen, hasBoldFace ? 'bold' : 'normal');
        } catch {
          /* keep the active font rather than failing the export */
        }

        const strokeBold = bold && !hasBoldFace;
        const previousLineWidth = doc.getLineWidth();
        if (strokeBold) {
          textOpts.renderingMode = 'fillThenStroke';
          doc.setLineWidth(doc.getFontSize() * 0.3528 * 0.038);
          try {
            doc.setDrawColor(doc.getTextColor());
          } catch {
            /* stroke keeps the previous draw colour */
          }
        }

        if (Object.keys(textOpts).length > 0) {
          doc.text(cleaned, x, y, textOpts);
        } else {
          doc.text(cleaned, x, y);
        }

        if (strokeBold) doc.setLineWidth(previousLineWidth);
      };

      if (!unicodeFontLoaded) {
        doc.setFont('helvetica', 'normal');
        console.log('⚠ Using Helvetica with character sanitization (Unicode font unavailable)');
      }

      const getTableFont = () => getPdfTableFont(loadedFonts, currentLanguage);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Glyph-accurate measurement: the same font drawText would pick, so CJK/Thai
      // widths are real widths and never Helvetica estimates.
      const measureText = (text, size) => {
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        if (!cleaned) return 0;
        const previousSize = doc.getFontSize();
        try {
          doc.setFont(choosePdfFont(cleaned, loadedFonts), 'normal');
        } catch {
          /* fall through: measure with whatever font is active */
        }
        doc.setFontSize(size);
        const width = doc.getTextWidth(cleaned);
        doc.setFontSize(previousSize);
        return width;
      };

      // Truncate by code point (never mid-surrogate) — CJK has no spaces to wrap on,
      // so splitTextToSize would run text off the page instead of breaking it.
      const ellipsis = unicodeFontLoaded ? '…' : '...';
      const fitText = (text, maxWidth, size) => {
        const cleaned = cleanTextForPDF(text, unicodeFontLoaded);
        if (!cleaned || maxWidth <= 0) return cleaned;
        if (measureText(cleaned, size) <= maxWidth) return cleaned;

        const chars = Array.from(cleaned);
        let low = 0;
        let high = chars.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (measureText(chars.slice(0, mid).join('') + ellipsis, size) <= maxWidth) {
            low = mid;
          } else {
            high = mid - 1;
          }
        }
        return low > 0 ? chars.slice(0, low).join('') + ellipsis : ellipsis;
      };

      // Separators degrade to ASCII when the Unicode font is unavailable.
      const dotSeparator = unicodeFontLoaded ? '·' : '|';
      const arrowSeparator = unicodeFontLoaded ? '→' : '->';

      const reportTitle = t('reports.performanceReport', 'HR PERFORMANCE REPORT');

      // Who the report is about, as the running header says it: a person, a unit
      // or the whole roster.
      const rawEmployeeName = describeExportSubject(employees, dotSeparator);

      const displayEmployeeName = unicodeFontLoaded
        ? rawEmployeeName
        : cleanTextForPDF(rawEmployeeName, false);

      // Running header on continuation pages: "Report — Employee · Page N", then a 2px rule.
      const emDash = unicodeFontLoaded ? '—' : '-';
      const headedPages = new Set([1]);
      const drawRunningHeader = () => {
        const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
        if (headedPages.has(pageNumber)) return PDF_TOKENS.contentTop;
        headedPages.add(pageNumber);

        const label = `${reportTitle} ${emDash} ${displayEmployeeName} ${dotSeparator} ${t('reports.page', 'Page')} ${pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(...PDF_TOKENS.ink);
        drawText(
          fitText(label, pageWidth - PDF_TOKENS.margin * 2, 8),
          PDF_TOKENS.margin,
          PDF_TOKENS.headerBaseline,
          { bold: true }
        );
        doc.setDrawColor(...PDF_TOKENS.ink);
        doc.setLineWidth(PDF_TOKENS.ruleHeavy);
        doc.line(
          PDF_TOKENS.margin,
          PDF_TOKENS.headerRule,
          pageWidth - PDF_TOKENS.margin,
          PDF_TOKENS.headerRule
        );
        return PDF_TOKENS.contentTop;
      };

      const layout = createPdfReportLayout({
        doc,
        pageWidth,
        pageHeight,
        drawText,
        measureText,
        fitText,
        onNewPage: drawRunningHeader
      });

      // ── Masthead: bold title left-aligned over meta lines, logo top-right ──
      layout.titleBlock({
        title: reportTitle.toUpperCase(),
        logo: companyLogo,
        metaLines: [
          `${t('reports.generated', 'Generated')}: ${new Date().toLocaleString()}`,
          `${t('reports.period', 'Period')}: ${filters.startDate} ${t('reports.to', 'to')} ${filters.endDate}`,
          `${t('employees.name', 'Name')}:- ${displayEmployeeName}`
        ]
      });

      // ── Summary overview: 2-column label/value grid + performance meter ────
      layout.sectionRule();
      layout.sectionHeading(t('reports.summaryOverview', 'SUMMARY OVERVIEW').toUpperCase());

      const summaryCell = (label, value) => ({ label, value: String(value) });
      layout.summaryGrid([
        summaryCell(t('reports.totalRecords', 'Total Records'), exportStats.totalRecords),
        timeEntries.length > 0
          ? summaryCell(t('reports.totalHours', 'Total Hours'), `${exportStats.totalHours}h`)
          : null,
        ...(tasks.length > 0 ? [
          summaryCell(t('reports.tasks', 'Tasks'), exportStats.tasksCount),
          summaryCell(t('reports.completedTasks', 'Completed Tasks'), exportStats.completedTasks)
        ] : []),
        ...(timeEntries.length > 0 ? [
          summaryCell(t('reports.timeEntries', 'Time Entries'), exportStats.timeEntriesCount),
          summaryCell(t('reports.approved', 'Approved'), exportStats.approvedTime)
        ] : []),
        ...(goals.length > 0 ? [
          summaryCell(t('reports.goals', 'Goals'), exportStats.goalsCount),
          summaryCell(t('reports.achievedGoals', 'Achieved Goals'), exportStats.achievedGoals)
        ] : []),
        ...(leave.length > 0 ? [
          summaryCell(t('reports.leave', 'Leave Requests'), exportStats.leaveCount),
          null
        ] : [])
      ]);

      // One employee → that employee's score; "all" → mean over the employees that
      // actually have records in this period (employees with none would skew it to 0).
      const scoredEmployees = selectedEmployee === 'all'
        ? employees
        : employees.filter((emp) => String(emp.id) === String(selectedEmployee));
      const employeeScores = scoredEmployees
        .map((employee) => computeEmployeePerformance(employee, timeEntries, tasks, goals))
        .filter((performance) => (
          selectedEmployee !== 'all'
          || performance.timeEntriesCount > 0
          || performance.tasksCount > 0
          || performance.goalsCount > 0
        ))
        .map((performance) => Number(performance.overallScore))
        .filter((score) => Number.isFinite(score));

      if (employeeScores.length > 0 && (timeEntries.length > 0 || tasks.length > 0 || goals.length > 0)) {
        const overallScore = employeeScores.reduce((sum, score) => sum + score, 0) / employeeScores.length;
        layout.meterRow({
          label: t('reports.excel.performance.overallScore', 'Overall Performance Score:'),
          valueText: `${overallScore.toFixed(1)}%`,
          filled: meterFilledBlocks(overallScore)
        });
      }

      const toChartItems = (countsMap, translateFn) =>
        withBarPercents(
          Object.entries(countsMap).map(([key, value]) => ({
            label: translateFn ? (translateFn(key) || key) : key,
            value
          }))
        ).map((item) => ({
          ...item,
          valueText: Number.isInteger(item.value) ? String(item.value) : formatHours(item.value)
        }));

      const pdfCharts = [];
      if (tasks.length > 0) {
        pdfCharts.push({
          title: t('reports.pdf.charts.taskStatusDistribution', 'Task Status Distribution'),
          items: toChartItems(aggregateCounts(tasks, 'status'), translateStatus)
        });
        pdfCharts.push({
          title: t('reports.pdf.charts.taskPriorityDistribution', 'Task Priority Distribution'),
          items: toChartItems(aggregateCounts(tasks, 'priority'), translatePriority)
        });
      }
      if (timeEntries.length > 0) {
        pdfCharts.push({
          title: t('reports.pdf.charts.hoursByType', 'Hours by Type'),
          items: toChartItems(aggregateHoursByType(timeEntries), translateHourType)
        });
        pdfCharts.push({
          title: t('reports.pdf.charts.statusDistribution', 'Time Entry Status Distribution'),
          items: toChartItems(aggregateCounts(timeEntries, 'status'), translateStatus)
        });
      }
      if (goals.length > 0) {
        pdfCharts.push({
          title: t('reports.pdf.charts.goalStatusDistribution', 'Goal Status Distribution'),
          items: toChartItems(aggregateCounts(goals, 'status'), translateStatus)
        });
        pdfCharts.push({
          title: t('reports.pdf.charts.goalCategoryDistribution', 'Goal Category Distribution'),
          items: toChartItems(aggregateCounts(goals, 'category'), translateCategory)
        });
      }

      // ── Visual analytics: bar groups (neutral track + accent fill) ─────────
      if (pdfCharts.length > 0) {
        layout.ensure(34); // keep the heading with at least the first rows
        layout.sectionRule();
        layout.sectionHeading(t('reports.pdf.visualAnalytics', 'VISUAL ANALYTICS').toUpperCase());
        pdfCharts.forEach((chart) => layout.barGroup(chart));
      }

      // ── Data tables: header row + data rows, thead repeats across pages ────
      const addPdfTable = (title, head, body, fontSize = 7, columnStyles = {}) => {
        if (body.length === 0) return;
        // Don't leave a heading (or a two-row stub) stranded at the foot of a page.
        const estimatedHeight = 24 + body.length * 5.8;
        layout.ensure(Math.min(estimatedHeight, 54));
        layout.sectionRule();
        layout.sectionHeading(title);

        autoTable(doc, {
          startY: layout.y,
          head: [head],
          body,
          theme: 'plain',
          showHead: 'everyPage',
          columnStyles,
          headStyles: {
            textColor: PDF_TOKENS.ink,
            fillColor: false,
            lineColor: PDF_TOKENS.ink,
            lineWidth: { bottom: PDF_TOKENS.ruleHeavy },
            fontStyle: 'normal',
            font: getTableFont()
          },
          bodyStyles: {
            textColor: PDF_TOKENS.inkSoft,
            lineColor: PDF_TOKENS.track,
            lineWidth: { bottom: PDF_TOKENS.ruleThin }
          },
          styles: {
            fontSize,
            cellPadding: { top: 1.6, right: 1.6, bottom: 1.6, left: 1.6 },
            font: getTableFont(),
            fontStyle: 'normal',
            overflow: 'linebreak'
          },
          didParseCell: function(data) {
            const cellText = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
            data.cell.styles.font = choosePdfFont(cellText, loadedFonts);
          },
          // Continuation pages created by autoTable still get the running header.
          didDrawPage: function() {
            drawRunningHeader();
          },
          margin: {
            top: PDF_TOKENS.contentTop,
            left: PDF_TOKENS.margin,
            right: PDF_TOKENS.margin,
            bottom: PDF_TOKENS.footerReserve
          }
        });

        layout.y = doc.lastAutoTable.finalY + 4;
      };

      const pdfHead = (key, fallback) => cleanTextForPDF(t(key, fallback), unicodeFontLoaded);
      const daysUnit = t('reports.daysShort', 'd');
      const daysCell = (days) => (days == null ? '-' : `${days} ${daysUnit}`);

      if (tasks.length > 0) {
        addPdfTable(
          t('reports.tasks', 'TASKS').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.pdf.headers.taskTitle', 'Task'),
            pdfHead('reports.pdf.headers.priority', 'Priority'),
            pdfHead('reports.pdf.headers.status', 'Status'),
            pdfHead('reports.pdf.headers.dueDate', 'Due Date'),
            pdfHead('reports.pdf.headers.estimatedHours', 'Est. days'),
            pdfHead('reports.pdf.headers.actualHours', 'Actual days')
          ],
          tasks.map((task) => {
            const duration = getTaskDurationDays(task);
            return [
              cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(task.employee, t) : (task.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
              cleanTextForPDF(translateDepartment(task.employee?.department) || '', unicodeFontLoaded),
              cleanTextForPDF((isDemoMode() ? getDemoTaskTitle(task, t) : mapUgc(ugcMap, task.title || '')).substring(0, 40), unicodeFontLoaded),
              cleanTextForPDF(translatePriority(task.priority), unicodeFontLoaded),
              cleanTextForPDF(translateStatus(task.status), unicodeFontLoaded),
              cleanTextForPDF(formatDate(task.due_date, currentLanguage, { day: '2-digit', month: 'short', year: 'numeric' }) || '-', unicodeFontLoaded),
              daysCell(duration.estimated),
              daysCell(duration.actual)
            ];
          }),
          7,
          {
            6: { halign: 'center' },
            7: { halign: 'center' }
          }
        );
      }

      if (timeEntries.length > 0) {
        addPdfTable(
          t('reports.timeEntries', 'TIME ENTRIES').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.pdf.headers.date', 'Date'),
            pdfHead('reports.pdf.headers.clockIn', 'Clock In'),
            pdfHead('reports.pdf.headers.clockOut', 'Clock Out'),
            pdfHead('reports.pdf.headers.hours', 'Hours'),
            pdfHead('reports.pdf.headers.hourType', 'Type'),
            pdfHead('reports.pdf.headers.status', 'Status')
          ],
          timeEntries.map((entry) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(entry.employee, t) : (entry.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(entry.employee?.department) || '', unicodeFontLoaded),
            entry.date,
            entry.clock_in || '-',
            entry.clock_out || '-',
            `${formatHours(entry.hours || 0)}h`,
            cleanTextForPDF(translateHourType(entry.hour_type), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(entry.status), unicodeFontLoaded)
          ])
        );
      }

      if (goals.length > 0) {
        addPdfTable(
          t('reports.personalGoals', 'PERSONAL GOALS').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.pdf.headers.goalTitle', 'Goal'),
            pdfHead('reports.pdf.headers.category', 'Category'),
            pdfHead('reports.pdf.headers.status', 'Status'),
            pdfHead('reports.pdf.headers.targetDate', 'Target Date'),
            pdfHead('reports.pdf.headers.progress', 'Progress')
          ],
          goals.map((goal) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(goal.employee, t) : (goal.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(goal.employee?.department) || '', unicodeFontLoaded),
            cleanTextForPDF((isDemoMode() ? getDemoGoalTitle(goal, t) : mapUgc(ugcMap, goal.title || '')).substring(0, 40), unicodeFontLoaded),
            cleanTextForPDF(translateCategory(goal.category), unicodeFontLoaded),
            cleanTextForPDF(translateStatus(goal.status), unicodeFontLoaded),
            goal.target_date || '-',
            `${goal.progress || 0}%`
          ])
        );
      }

      if (leave.length > 0) {
        addPdfTable(
          t('reports.leave', 'LEAVE REQUESTS').toUpperCase(),
          [
            pdfHead('reports.pdf.headers.employee', 'Employee'),
            pdfHead('reports.pdf.headers.department', 'Department'),
            pdfHead('reports.leaveType', 'Leave Type'),
            pdfHead('reports.dateRange', 'Date Range'),
            pdfHead('reports.days', 'Days'),
            pdfHead('reports.pdf.headers.status', 'Status')
          ],
          leave.map((req) => [
            cleanTextForPDF(isDemoMode() ? getDemoEmployeeName(req.employee, t) : (req.employee?.name || t('reports.unknown', 'Unknown')), unicodeFontLoaded),
            cleanTextForPDF(translateDepartment(req.employee?.department) || '', unicodeFontLoaded),
            cleanTextForPDF(translateLeaveType(req.leave_type), unicodeFontLoaded),
            `${(req.start_date || '').slice(0, 10)} ${arrowSeparator} ${(req.end_date || req.start_date || '').slice(0, 10)}`,
            String(req.days_count ?? '-'),
            cleanTextForPDF(translateStatus(req.status), unicodeFontLoaded)
          ])
        );
      }

      // The per-person overview is scored from hours, tasks and goals, so it is
      // only meaningful when at least one of those types is in scope.
      if (selectedEmployee === 'all' && employees.length > 0 && (scope.timeEntries || scope.tasks || scope.goals)) {
        addPdfTable(
          t('reports.excel.sheets.allEmployeesOverview', 'ALL EMPLOYEES OVERVIEW').toUpperCase(),
          [
            pdfHead('reports.excel.performance.name', 'Name'),
            pdfHead('reports.excel.performance.department', 'Department'),
            pdfHead('reports.excel.metrics.totalHours', 'Hours'),
            pdfHead('reports.excel.metrics.totalTasks', 'Tasks'),
            pdfHead('reports.excel.metrics.completedTasks', 'Completed'),
            pdfHead('reports.excel.metrics.totalGoals', 'Goals'),
            pdfHead('reports.excel.performance.overallScore', 'Score')
          ],
          employees.map((employee) => {
            const performance = computeEmployeePerformance(employee, timeEntries, tasks, goals);
            return [
              cleanTextForPDF(getDemoEmployeeName(employee, t), unicodeFontLoaded),
              cleanTextForPDF(translateDepartment(employee.department), unicodeFontLoaded),
              formatHours(performance.totalHours),
              String(performance.tasksCount),
              String(performance.completedTasks),
              String(performance.goalsCount),
              `${performance.overallScore}%`
            ];
          }),
          6
        );
      }

      // ── Footer rule + "Page N/M · Generated by …" and the locale code ──────
      const pageCount = doc.internal.getNumberOfPages();
      const localeCode = (SUPPORTED_LANGUAGES[currentLanguage]?.code || currentLanguage || 'en').toUpperCase();
      const footerRuleY = pageHeight - PDF_TOKENS.footerRule;
      const footerBaselineY = pageHeight - PDF_TOKENS.footerBaseline;
      const footerRight = pageWidth - PDF_TOKENS.margin;

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...PDF_TOKENS.ink);
        doc.setLineWidth(PDF_TOKENS.ruleHeavy);
        doc.line(PDF_TOKENS.margin, footerRuleY, footerRight, footerRuleY);

        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_TOKENS.muted);
        const localeWidth = measureText(localeCode, 7.5);
        const footerLabel = `${t('reports.page', 'Page')} ${i}/${pageCount} ${dotSeparator} ${t('reports.generatedBy', 'Generated by HR Management System')}`;
        drawText(
          fitText(footerLabel, pageWidth - PDF_TOKENS.margin * 2 - localeWidth - 6, 7.5),
          PDF_TOKENS.margin,
          footerBaselineY
        );
        drawText(localeCode, footerRight, footerBaselineY, { align: 'right' });
      }

      // Save the PDF
      const filename = buildExportFilename('pdf');
      doc.save(filename);

      rememberExport(filename, exportStats.totalRecords);
      alert(t('reports.pdfExportSuccess', 'PDF report exported successfully!'));
    } catch (error) {
      console.error('Error exporting PDF:', error);
      if (handleSessionAuthError(error)) return;
      alert(t('reports.errorExporting', 'Error exporting PDF file'));
    } finally {
      setExporting(false);
    }
  };

  /* ------------------------------------------------------------------ *
   * "Industry" chrome (src/theme/industry.js). Radius 0, cards are
   * outlines with four registration corners, and status reads through
   * weight and rule rather than a coloured pill per state.
   *
   * The screen is one full-width spec sheet: scope, composition, preview
   * and the export dock stacked down the page, each band ruled off with
   * registration crosses at its corners.
   * ------------------------------------------------------------------ */

  const frameStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
    fontFamily: BODY,
    fontSize: 14,
    borderRadius: 0,
  };
  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const noteStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: 0 };
  const fieldLabelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 4,
  };
  const thStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.12em',
    textTransform: 'uppercase', color: ind.inkMuted,
    padding: '0 10px 8px', textAlign: 'left', whiteSpace: 'nowrap', userSelect: 'none',
  };
  const tdStyle = {
    fontFamily: BODY, fontSize: 13, color: ind.ink,
    padding: '9px 10px', borderTop: `1px solid ${ind.rule}`, verticalAlign: 'middle',
  };
  const subCellStyle = { fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, marginTop: 2 };
  const figureStyle = { fontFamily: DISPLAY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' };

  /**
   * approved / completed is settled work → filled accent.
   * pending / in progress is asking for something → outline.
   * everything else is passive → neutral.
   */
  const statusVariant = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'approved' || value === 'completed') return 'accent';
    if (value === 'pending' || value === 'in_progress' || value === 'in-progress') return 'outline';
    return 'neutral';
  };

  const rangeLabel = `${filters.startDate} → ${filters.endDate}`;
  const scopeCount = SCOPE_KEYS.filter((key) => scope[key]).length;

  /* ── 01 · RECORDS ─────────────────────────────────────────────────── */

  const scopeCards = [
    { key: 'timeEntries', label: t('reports.timeEntries', 'Time Entries'), count: availableCounts.timeEntries },
    { key: 'leave', label: t('reports.leave', 'Leave Requests'), count: availableCounts.leave },
    { key: 'tasks', label: t('reports.tasks', 'Tasks'), count: availableCounts.tasks },
    { key: 'goals', label: t('reports.personalGoals', 'Personal Goals'), count: availableCounts.goals },
  ];

  /** Never let the sheet reach an export with nothing in it. */
  const toggleScope = (key) => {
    setScope((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return SCOPE_KEYS.some((scopeKey) => next[scopeKey]) ? next : prev;
    });
  };

  /* ── Preview ledger columns ───────────────────────────────────────── */

  const previewColumns = [
    { id: 'date', label: t('reports.date', 'Date'), locked: true },
    { id: 'employee', label: t('reports.employees', 'Employee'), locked: true },
    { id: 'unit', label: t('reports.unit', 'Unit') },
    { id: 'typeLabel', label: t('reports.type', 'Type') },
    { id: 'amount', label: t('reports.hours', 'Hours'), align: 'right' },
    { id: 'status', label: t('reports.status', 'Status') },
    { id: 'approvedBy', label: t('reports.approvedBy', 'Approved by') },
    { id: 'source', label: t('reports.source', 'Source') },
  ];
  const visibleColumns = previewColumns.filter((column) => !hiddenColumns.has(column.id));

  const toggleColumn = (id) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const attentionLabel = {
    approved: t('reports.statusApproved', 'Approved'),
    pending: t('reports.statusPending', 'Pending'),
    rejected: t('reports.statusRejected', 'Rejected'),
    'long-shift': t('reports.checkLongShiftsShort', 'Over 12h'),
  }[attention];

  const renderCell = (row, column) => {
    switch (column.id) {
      case 'date':
        return <span style={{ ...figureStyle, fontSize: 12.5, letterSpacing: '.06em' }}>{row.date || '—'}</span>;
      case 'employee':
        return (
          <>
            <div className="truncate">{row.employee}</div>
            {row.note && (
              <div className="truncate" style={subCellStyle}>
                {row.noteIsUgc ? <TranslatedText text={row.note} /> : row.note}
              </div>
            )}
          </>
        );
      case 'typeLabel':
        return <Tag ind={ind} variant={row.typeVariant}>{row.typeLabel}</Tag>;
      case 'amount':
        return <span style={{ ...figureStyle, fontSize: 13 }}>{row.amountText}</span>;
      case 'status':
        return <Tag ind={ind} variant={statusVariant(row.status)}>{translateStatus(row.status)}</Tag>;
      default:
        return row[column.id] || '—';
    }
  };

  /* ── Export dock ──────────────────────────────────────────────────── */

  const exportFormats = [
    { value: 'csv', label: 'CSV' },
    { value: 'xlsx', label: 'XLSX' },
    { value: 'pdf', label: 'PDF' },
  ];

  const runExport = () => {
    if (exportFormat === 'xlsx') return exportToExcel();
    if (exportFormat === 'pdf') return exportToPDF();
    return exportAllToCSV();
  };

  const resetSheet = () => {
    setScope({ timeEntries: true, leave: true, tasks: true, goals: true });
    setSelectedEmployee('all');
    setSelectedUnit('all');
    setActiveOnly(true);
    setDateRange('this-month');
    setAttention(null);
    setHiddenColumns(new Set());
  };

  const lastExportLine = lastExport
    ? [
        lastExport.filename,
        `${Number(lastExport.rows || 0).toLocaleString()} ${t('reports.records', 'records')}`,
        lastExport.by
          ? `${t('reports.by', 'by')} ${lastExport.by}, ${new Date(lastExport.at).toLocaleString()}`
          : new Date(lastExport.at).toLocaleString(),
      ].join(' · ')
    : null;

  return (
    <div data-screen-label="Reports" style={frameStyle}>

      {/* ── TICKER — what this export currently amounts to ───────────── */}
      <div
        style={{
          height: 44, background: ind.tickerBg, color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind}>
          <LiveClock ind={ind} live={!loading && totals.rows > 0} />
        </TickerCell>
        <TickerCell
          ind={ind}
          label={t('reports.inScope', 'In scope')}
          value={totals.rows.toLocaleString()}
        />
        {/* Light steel singles out the one figure on the strip that asks for
            something to be done before the file is written. */}
        <TickerCell
          ind={ind}
          label={t('reports.pending', 'Pending')}
          value={totals.pending.toLocaleString()}
          valueColor={totals.pending > 0 ? ind.tickerUp : undefined}
          title={t('reports.pendingTickerHint', 'Time entries and leave still awaiting approval')}
        />
        <TickerCell ind={ind} label={t('reports.people', 'People')} value={totals.people.toLocaleString()} />
        <TickerCell ind={ind} label={t('reports.range', 'Range')} value={rangeLabel} />

        <div
          style={{
            flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 8, padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading || exporting} isDarkMode label={t('common.fetching', 'Fetching')} />
        </div>
      </div>

      {/* ── SHEET ───────────────────────────────────────────────────── */}
      <div style={{ padding: '22px 26px 26px' }}>

        {fetchError && (
          <div
            style={{
              border: `1px solid ${ind.ink}`, padding: '12px 14px', marginBottom: 20,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
              <p style={{ ...caption, marginTop: 4 }}>{fetchError}</p>
              <Btn ind={ind} onClick={() => { setFetchError(null); fetchReportData(); }} style={{ marginTop: 10 }}>
                {t('common.retry', 'Try Again')}
              </Btn>
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

        {/* ── PAGE HEAD ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 16, marginBottom: 22 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
              {t('nav.reports', 'Reports')}
            </h1>
            <p style={{ ...caption, marginTop: 6 }}>
              {lastExportLine
                ? `${t('reports.lastExport', 'Last export')} ${lastExportLine}`
                : t('reports.subtitle', 'Export comprehensive data for time entries, tasks, and personal goals')}
            </p>
          </div>

          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            <Btn ind={ind} onClick={() => fetchReportData()} disabled={loading}>
              {loading ? t('common.loading', 'Loading') : t('common.refresh', 'Refresh')}
            </Btn>
            <Btn ind={ind} onClick={resetSheet}>{t('reports.resetFilters', 'Reset Filters')}</Btn>
          </div>
        </div>

        {/* ── 01 · RECORDS / 02 · PEOPLE / 03 · PERIOD ──────────────── */}
        <Band ind={ind} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <Cell ind={ind} className="md:col-span-2">
            <PanelHead
              ind={ind}
              num="01"
              title={t('reports.records', 'Records')}
              right={
                <span style={{ ...noteStyle, flex: 'none' }}>
                  {`${scopeCount}/${SCOPE_KEYS.length} ${t('reports.selected', 'selected')}`}
                </span>
              }
            />
            <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 8 }}>
              {scopeCards.map((card) => {
                const on = scope[card.key];
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => toggleScope(card.key)}
                    aria-pressed={on}
                    style={{
                      textAlign: 'left', padding: '9px 11px', borderRadius: 0, cursor: 'pointer',
                      border: `1px solid ${on ? ind.accent : ind.hairline}`,
                      background: on ? ind.accentWash : 'transparent',
                      transition: 'background .15s ease, border-color .15s ease',
                    }}
                  >
                    <span className="flex items-center" style={{ gap: 7 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 12, height: 12, flex: 'none', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${on ? ind.accent : ind.inkFaint}`,
                          background: on ? ind.accent : 'transparent',
                        }}
                      >
                        {on && <Check size={9} strokeWidth={3} style={{ color: ind.accentInk }} />}
                      </span>
                      <span
                        style={{
                          ...figureStyle, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
                          color: on ? ind.ink : ind.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {card.label}
                      </span>
                    </span>
                    <span
                      style={{
                        ...figure(24, on ? ind.ink : ind.inkFaint),
                        display: 'block', marginTop: 6,
                      }}
                    >
                      <SlidingNumber value={card.count} />
                    </span>
                  </button>
                );
              })}
            </div>
          </Cell>

          <Cell ind={ind}>
            <PanelHead ind={ind} num="02" title={t('reports.people', 'People')} />
            <FlatListbox
              ind={ind}
              id="report-employee"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              aria-label={t('reports.employee', 'Employee')}
              style={{ width: '100%', textTransform: 'none', letterSpacing: '.02em', padding: '6px 8px' }}
            >
              <option value="all">
                {`${t('reports.allEmployees', 'All Employees')} · ${activeOnly ? activeEmployees.length : reportData.employees.length}`}
              </option>
              {[...(activeOnly ? activeEmployees : reportData.employees)]
                .sort((a, b) => getDemoEmployeeName(a, t).localeCompare(getDemoEmployeeName(b, t)))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {`${getDemoEmployeeName(emp, t)} · ${translateDepartment(emp.department)}`}
                  </option>
                ))}
            </FlatListbox>

            <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 10 }}>
              <FlatSelect
                ind={ind}
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                aria-label={t('reports.byUnit', 'By unit')}
                disabled={selectedEmployee !== 'all'}
                style={{
                  textTransform: 'none', letterSpacing: '.02em',
                  opacity: selectedEmployee !== 'all' ? 0.45 : 1,
                  cursor: selectedEmployee !== 'all' ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="all">{t('reports.byUnit', 'By unit')}</option>
                {units.map((unit) => (
                  <option key={unit} value={unit}>{translateDepartment(unit)}</option>
                ))}
              </FlatSelect>

              <Btn
                ind={ind}
                variant={activeOnly ? 'primary' : 'secondary'}
                onClick={() => setActiveOnly((prev) => !prev)}
                aria-pressed={activeOnly}
                title={t('reports.activeOnlyHint', 'Exclude people who have left the company')}
              >
                {t('reports.activeOnly', 'Active only')}
              </Btn>
            </div>

            <p style={{ ...noteStyle, marginTop: 10 }}>
              {`${totals.people} ${t('reports.peopleInScope', 'people in scope')}`}
              {peopleWithNoRecords.length > 0 && ` · ${peopleWithNoRecords.length} ${t('reports.withoutRecords', 'without records')}`}
            </p>
          </Cell>

          <Cell ind={ind}>
            <PanelHead ind={ind} num="03" title={t('reports.period', 'Period')} />
            <Seg
              ind={ind}
              ariaLabel={t('reports.dateRange', 'Date Range')}
              value={dateRange}
              onChange={setDateRange}
              options={[
                { value: 'this-month', label: t('reports.thisMonth', 'This Month') },
                { value: 'last-month', label: t('reports.lastMonth', 'Last Month') },
                { value: 'this-quarter', label: t('reports.quarter', 'Quarter') },
                { value: 'custom', label: t('reports.custom', 'Custom') },
              ]}
            />

            {dateRange === 'custom' ? (
              <div className="flex flex-wrap items-end" style={{ gap: 10, marginTop: 12 }}>
                <div style={{ width: 148 }}>
                  <label htmlFor="report-start" style={fieldLabelStyle}>{t('reports.startDate', 'Start Date')}</label>
                  <DatePicker
                    flat
                    id="report-start"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div style={{ width: 148 }}>
                  <label htmlFor="report-end" style={fieldLabelStyle}>{t('reports.endDate', 'End Date')}</label>
                  <DatePicker
                    flat
                    id="report-end"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline" style={{ gap: 10, marginTop: 12 }}>
                <span style={{ ...figureStyle, fontSize: 14, letterSpacing: '.06em', color: ind.ink }}>
                  {filters.startDate}
                </span>
                <span style={{ color: ind.inkFaint }}>→</span>
                <span style={{ ...figureStyle, fontSize: 14, letterSpacing: '.06em', color: ind.ink }}>
                  {filters.endDate}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 10 }}>
              <span style={{ ...noteStyle }}>
                {`${totals.workingDays} ${t('reports.workingDays', 'working days')}`}
              </span>
              {[
                { value: 'today', label: t('reports.today', 'Today') },
                { value: 'this-week', label: t('reports.thisWeek', 'This Week') },
                { value: 'this-year', label: t('reports.thisYear', 'This Year') },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDateRange(preset.value)}
                  style={{
                    ...figureStyle, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: dateRange === preset.value ? ind.accent : ind.inkFaint,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Cell>
        </Band>

        {/* ── COMPOSITION ───────────────────────────────────────────── */}
        <Band ind={ind} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <Cell ind={ind}>
            <PanelHead
              ind={ind}
              title={t('reports.byType', 'By type')}
              right={
                <span style={{ ...noteStyle, flex: 'none' }}>
                  {`${formatHours(totals.hours)} ${t('reports.hoursShort', 'h')}`}
                </span>
              }
            />
            {byType.length === 0 ? (
              <p style={noteStyle}>{t('reports.noData', 'No data found')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {byType.map((row) => (
                  <div key={row.id} className="flex items-baseline" style={{ gap: 10 }}>
                    <span
                      style={{
                        fontFamily: BODY, fontSize: 12.5, color: ind.ink, flex: 1, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {row.label}
                    </span>
                    {row.hours != null && (
                      <span style={{ ...figureStyle, fontSize: 11.5, color: ind.inkFaint, flex: 'none' }}>
                        {`${formatHours(row.hours)}h`}
                      </span>
                    )}
                    <span style={{ ...figureStyle, fontSize: 13.5, color: ind.ink, flex: 'none', minWidth: 42, textAlign: 'right' }}>
                      {row.count.toLocaleString()}
                    </span>
                    <span style={{ ...figureStyle, fontSize: 11.5, color: ind.inkFaint, flex: 'none', minWidth: 30, textAlign: 'right' }}>
                      {`${Math.round(row.pct * 100)}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Cell>

          <Cell ind={ind}>
            <PanelHead
              ind={ind}
              title={t('reports.byStatus', 'By status')}
              right={
                <span style={{ ...noteStyle, flex: 'none' }}>
                  {`${t('reports.timeAndLeave', 'time & leave')}, ${byStatus.total.toLocaleString()}`}
                </span>
              }
            />
            {byStatus.total === 0 ? (
              <p style={noteStyle}>{t('reports.noApprovableRecords', 'No approvable records in scope')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'approved', label: translateStatus('approved'), value: byStatus.approved, rank: 0 },
                  { id: 'pending', label: t('reports.pendingApproval', 'Pending approval'), value: byStatus.pending, rank: 1 },
                  { id: 'rejected', label: translateStatus('rejected'), value: byStatus.rejected, rank: 3 },
                ].map((row) => {
                  const emphasised = row.id === 'pending' && row.value > 0;
                  return (
                    <div key={row.id}>
                      <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 5 }}>
                        <button
                          type="button"
                          onClick={() => setAttention(attention === row.id ? null : row.id)}
                          style={{
                            fontFamily: BODY, fontSize: 12.5, background: 'none', border: 'none', padding: 0,
                            cursor: 'pointer', textAlign: 'left', minWidth: 0,
                            color: emphasised ? ind.accentDeep : ind.ink,
                            fontWeight: emphasised ? 600 : 400,
                          }}
                        >
                          {row.label}
                        </button>
                        <span style={{ ...figureStyle, fontSize: 14, color: ind.ink, flex: 'none' }}>
                          {row.value.toLocaleString()}
                        </span>
                      </div>
                      <Bar
                        ind={ind}
                        value={byStatus.total > 0 ? row.value / byStatus.total : 0}
                        fill={rampAt(ind, row.rank)}
                        height={7}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Cell>

          <Cell ind={ind}>
            <PanelHead ind={ind} title={t('reports.byWeek', 'By week')} />
            {byWeek.length === 0 ? (
              <p style={noteStyle}>{t('reports.noData', 'No data found')}</p>
            ) : (
              <div className="flex items-end" style={{ gap: 6, height: 128, overflowX: 'auto' }}>
                {byWeek.map((bucket) => (
                  <div
                    key={bucket.label + bucket.from.toISOString()}
                    className="flex flex-col items-center justify-end"
                    style={{ flex: '1 1 0', minWidth: 34, height: '100%' }}
                    title={`${bucket.from.toISOString().slice(0, 10)} → ${bucket.to.toISOString().slice(0, 10)}`}
                  >
                    <span style={{ ...figureStyle, fontSize: 11, color: ind.inkMuted, marginBottom: 4 }}>
                      {bucket.count.toLocaleString()}
                    </span>
                    {/* The bar is measured against what is left after the two
                        labels, so a tall column can never push them out. */}
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(bucket.share * 100, bucket.count > 0 ? 4 : 1)}%`,
                          border: `1px solid ${ind.hairline}`,
                          // A week still accruing reads as an empty frame.
                          background: bucket.partial ? 'transparent' : ind.accentFill,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        ...figureStyle, fontSize: 10, letterSpacing: '.1em', color: ind.inkFaint,
                        marginTop: 5, whiteSpace: 'nowrap',
                      }}
                    >
                      {bucket.label}{bucket.partial ? '*' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Cell>

          <Cell ind={ind}>
            <PanelHead ind={ind} title={t('reports.beforeYouExport', 'Before you export')} />
            {checks.length === 0 ? (
              <div className="flex items-start" style={{ gap: 9 }}>
                <CheckCircle size={14} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.accent }} />
                <p style={{ ...caption, fontSize: 12.5 }}>
                  {`${totals.rows.toLocaleString()} ${t('reports.rowsReady', 'rows ready — nothing needs attention.')}`}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {checks.map((check) => {
                  const CheckIcon = check.Icon;
                  return (
                    <div key={check.id} className="flex items-start" style={{ gap: 9 }}>
                      <CheckIcon size={14} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.inkMuted }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ ...caption, fontSize: 12.5, color: ind.ink }}>
                          <strong style={{ fontWeight: 600 }}>{check.lead}</strong>
                          {check.rest ? ` — ${check.rest}` : ''}
                        </p>
                        <button
                          type="button"
                          onClick={check.onAction}
                          className="inline-flex items-center"
                          style={{
                            ...figureStyle, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                            color: ind.accent, background: 'none', border: 'none', padding: 0,
                            cursor: 'pointer', gap: 5, marginTop: 4,
                          }}
                        >
                          {check.actionLabel}
                          <ArrowRight size={11} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Cell>
        </Band>

        {/* ── ONE PERSON — only when the sheet is scoped to one ──────── */}
        {selectedEmployee !== 'all' && cohort.length === 1 && (() => {
          const employee = cohort[0];
          const entries = scopedData.timeEntries;
          const hoursOf = (predicate) => entries.filter(predicate).reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
          const regularHours = hoursOf((entry) => entry.hour_type === 'regular');
          const overtimeHours = hoursOf((entry) => entry.hour_type === 'overtime' || entry.hour_type === 'bonus');
          const wfhHours = hoursOf((entry) => entry.hour_type === 'wfh');
          const daysWorked = new Set(entries.map((entry) => entry.date)).size;
          const completedTasks = scopedData.tasks.filter((task) => task.status === 'completed').length;
          const taskRate = scopedData.tasks.length > 0
            ? Number(((completedTasks / scopedData.tasks.length) * 100).toFixed(1))
            : 0;
          const goalProgress = scopedData.goals.length > 0
            ? Number((scopedData.goals.reduce((sum, goal) => sum + (goal.status === 'completed' ? 100 : (Number(goal.progress) || 0)), 0) / scopedData.goals.length).toFixed(1))
            : 0;
          const leaveDays = scopedData.leave
            .filter((request) => request.status === 'approved')
            .reduce((sum, request) => sum + (Number(request.days_count) || 0), 0);

          return (
            <Band ind={ind} className="grid-cols-1">
              <Cell ind={ind}>
                <PanelHead
                  ind={ind}
                  title={`${getDemoEmployeeName(employee, t)} — ${t('reports.performanceSummary', 'Performance Summary')}`}
                  right={
                    <span style={{ ...noteStyle, flex: 'none' }}>
                      {`${translateDepartment(employee.department)} · ${translatePosition(employee.position)}`}
                    </span>
                  }
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" style={{ gap: 8 }}>
                  <FigureBlock
                    ind={ind}
                    label={t('reports.hours', 'Hours')}
                    value={Number(formatHours(totals.hours))}
                    suffix="h"
                    description={t('reports.totalHours', 'Total Hours')}
                  />
                  <FigureBlock
                    ind={ind}
                    label={t('reports.regular', 'Regular')}
                    value={Number(formatHours(regularHours))}
                    suffix="h"
                    description={t('reports.regularHours', 'Regular Hours')}
                  />
                  <FigureBlock
                    ind={ind}
                    label={t('reports.overtime', 'Overtime')}
                    value={Number(formatHours(overtimeHours))}
                    suffix="h"
                    description={t('reports.overtime', 'Overtime')}
                  />
                  <FigureBlock
                    ind={ind}
                    label={t('reports.wfh', 'WFH')}
                    value={Number(formatHours(wfhHours))}
                    suffix="h"
                    description={t('reports.wfh', 'Working From Home')}
                  />
                  <FigureBlock
                    ind={ind}
                    label={t('reports.days', 'Days')}
                    value={daysWorked}
                    description={t('reports.daysWorked', 'Days Worked')}
                  />
                  <FigureBlock
                    ind={ind}
                    label={t('reports.leave', 'Leave')}
                    value={leaveDays}
                    description={t('reports.leaveDays', 'Leave Days')}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12, marginTop: 12 }}>
                  <div style={{ border: `1px solid ${ind.hairline}`, padding: '12px 14px' }}>
                    <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
                      <CheckCircle size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                      <ColumnHeading ind={ind} style={{ fontSize: 12 }}>
                        {`${t('reports.tasks', 'Tasks')} (${scopedData.tasks.length})`}
                      </ColumnHeading>
                    </div>
                    <StatLine ind={ind} label={t('reports.completed', 'Completed')} value={completedTasks} />
                    <div style={{ marginTop: 6 }}>
                      <StatLine ind={ind} label={t('reports.completionRate', 'Completion Rate')} value={taskRate} decimals={1} suffix="%" />
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <Bar ind={ind} value={taskRate / 100} height={6} />
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${ind.hairline}`, padding: '12px 14px' }}>
                    <div className="flex items-center" style={{ gap: 7, marginBottom: 9 }}>
                      <Goal size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkMuted }} />
                      <ColumnHeading ind={ind} style={{ fontSize: 12 }}>
                        {`${t('reports.goals', 'Goals')} (${scopedData.goals.length})`}
                      </ColumnHeading>
                    </div>
                    <StatLine
                      ind={ind}
                      label={t('reports.completed', 'Completed')}
                      value={scopedData.goals.filter((goal) => goal.status === 'completed').length}
                    />
                    <div style={{ marginTop: 6 }}>
                      <StatLine ind={ind} label={t('reports.avgProgress', 'Avg Progress')} value={goalProgress} decimals={1} suffix="%" />
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <Bar ind={ind} value={goalProgress / 100} height={6} />
                    </div>
                  </div>
                </div>
              </Cell>
            </Band>
          );
        })()}

        {/* ── PREVIEW LEDGER ────────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <BandMarks ind={ind} />
          <div style={{ border: `1px solid ${ind.hairline}`, padding: '16px 18px 0' }}>
            <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 12, marginBottom: 14 }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: 10 }}>
                <span style={{ ...figureStyle, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: ind.ink }}>
                  {`${t('reports.preview', 'Preview')} · ${previewRows.length.toLocaleString()} ${t('reports.rows', 'rows')}`}
                </span>
                {attention && (
                  <button
                    type="button"
                    onClick={() => setAttention(null)}
                    className="inline-flex items-center"
                    style={{
                      ...figureStyle, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
                      gap: 5, padding: '2px 6px', cursor: 'pointer',
                      border: `1px solid ${ind.accent}`, background: ind.accentWash, color: ind.accentDeep,
                    }}
                  >
                    {attentionLabel}
                    <X size={10} strokeWidth={2} />
                  </button>
                )}
              </div>

              <div className="flex items-center" style={{ gap: 16 }}>
                <span style={{ ...figureStyle, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkFaint }}>
                  {`${t('reports.sortedBy', 'Sorted by')} ${(previewColumns.find((column) => column.id === sortKey) || {}).label || sortKey} ${sortDirection === 'asc' ? '↑' : '↓'}`}
                </span>

                <div style={{ position: 'relative' }} ref={columnMenuRef}>
                  <button
                    type="button"
                    onClick={() => setColumnMenuOpen((open) => !open)}
                    className="inline-flex items-center"
                    style={{
                      ...figureStyle, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                      color: ind.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer', gap: 5,
                    }}
                  >
                    {t('reports.chooseColumns', 'Choose columns')}
                    <ArrowRight size={11} strokeWidth={2} />
                  </button>

                  {columnMenuOpen && (
                    <div
                      style={{
                        position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 20, minWidth: 210,
                        border: `1px solid ${ind.hairline}`, background: ind.chrome, padding: '10px 12px',
                        boxShadow: '0 12px 28px rgba(0,0,0,.14)',
                      }}
                    >
                      <Kicker ind={ind} style={{ marginBottom: 8 }}>
                        {t('reports.previewColumns', 'Preview columns')}
                      </Kicker>
                      {previewColumns.map((column) => {
                        const shown = !hiddenColumns.has(column.id);
                        return (
                          <button
                            key={column.id}
                            type="button"
                            disabled={column.locked}
                            onClick={() => toggleColumn(column.id)}
                            className="flex items-center w-full"
                            style={{
                              gap: 8, padding: '5px 0', background: 'none', border: 'none',
                              cursor: column.locked ? 'not-allowed' : 'pointer',
                              opacity: column.locked ? 0.5 : 1, textAlign: 'left',
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: 11, height: 11, flex: 'none', display: 'inline-flex',
                                alignItems: 'center', justifyContent: 'center',
                                border: `1px solid ${shown ? ind.accent : ind.inkFaint}`,
                                background: shown ? ind.accent : 'transparent',
                              }}
                            >
                              {shown && <Check size={8} strokeWidth={3} style={{ color: ind.accentInk }} />}
                            </span>
                            <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{column.label}</span>
                          </button>
                        );
                      })}
                      <p style={{ ...noteStyle, marginTop: 8 }}>
                        {t('reports.previewColumnsNote', 'Affects this preview. Exports always carry every field.')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    {visibleColumns.map((column) => {
                      const active = sortKey === column.id;
                      return (
                        <th key={column.id} style={{ ...thStyle, textAlign: column.align || 'left' }}>
                          <button
                            type="button"
                            onClick={() => handleSort(column.id)}
                            style={{
                              font: 'inherit', color: active ? ind.ink : 'inherit', letterSpacing: 'inherit',
                              textTransform: 'inherit', background: 'none', border: 'none', padding: 0,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {column.label}
                            <span aria-hidden="true" style={{ opacity: active ? 1 : 0.3 }}>
                              {active && sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} style={{ ...tdStyle, padding: '44px 10px', textAlign: 'center' }}>
                        <FileText size={26} strokeWidth={1.25} style={{ color: ind.inkFaint, margin: '0 auto' }} />
                        <div style={{ marginTop: 10 }}>
                          <ColumnHeading ind={ind}>{t('reports.noData', 'No data found')}</ColumnHeading>
                        </div>
                        <p style={{ ...caption, marginTop: 5 }}>
                          {t('reports.adjustFilters', 'Try adjusting your filters or date range')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row) => (
                      <tr key={row.key}>
                        {visibleColumns.map((column) => (
                          <td
                            key={column.id}
                            style={{
                              ...tdStyle,
                              textAlign: column.align || 'left',
                              whiteSpace: column.id === 'date' ? 'nowrap' : undefined,
                              maxWidth: column.id === 'employee' ? 280 : undefined,
                            }}
                          >
                            {renderCell(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger foot — the preview is paged; the export is not. */}
            <div
              className="flex flex-wrap items-center justify-between"
              style={{ gap: 10, padding: '11px 0', marginTop: 4, borderTop: `1px solid ${ind.hairline}` }}
            >
              <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>
                {`${t('reports.showing', 'Showing')} ${previewRows.length.toLocaleString()} ${t('reports.of', 'of')} ${sortedRows.length.toLocaleString()} ${t('reports.rows', 'rows')} · ${t('reports.exportCarriesEveryRow', 'the export carries every row in scope, not the preview')}`}
              </span>
              {previewRows.length < sortedRows.length && (
                <button
                  type="button"
                  onClick={() => setVisibleRows((rows) => rows + PREVIEW_PAGE)}
                  className="inline-flex items-center"
                  style={{
                    ...figureStyle, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                    color: ind.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer', gap: 5,
                  }}
                >
                  {`${t('reports.load', 'Load')} ${PREVIEW_PAGE}`}
                  <ArrowRight size={11} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── EXPORT DOCK — the only place on the sheet that writes a file ─ */}
      <div
        style={{
          position: 'sticky', bottom: 0, zIndex: 10,
          borderTop: `1px solid ${ind.hairline}`, background: ind.chrome,
          padding: '12px 26px', display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between', gap: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Kicker ind={ind}>{t('reports.writes', 'Writes')}</Kicker>
          <div
            style={{
              ...figureStyle, fontSize: 15, letterSpacing: '.02em', color: ind.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2,
            }}
          >
            {buildExportFilename(exportFormat)}
          </div>
          <p style={{ ...noteStyle, marginTop: 3 }}>
            {[
              `${totals.rows.toLocaleString()} ${t('reports.rows', 'rows')}`,
              `${scopeCount} ${t('reports.recordTypes', 'record types')}`,
              exportFormat === 'csv' && totals.rows > 0
                ? `${t('reports.estimated', 'est.')} ${formatBytes(estimatedCsvBytes)}`
                : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
          <Seg
            ind={ind}
            ariaLabel={t('reports.format', 'Format')}
            value={exportFormat}
            onChange={setExportFormat}
            options={exportFormats}
          />
          {/* Kept as a SpecularButton — the sheen is what marks the one action
              on the sheet that leaves the app. Re-skinned, not stripped. */}
          <SpecularButton
            type="button"
            onClick={runExport}
            disabled={exporting || totals.rows === 0}
            shineOnHover
            title={t('reports.exportingIncludes', 'Exporting will include all filtered data, not just previewed records')}
            className={cn('rounded-none border px-4 py-2')}
            style={{
              borderRadius: 0,
              background: ind.accent,
              color: ind.accentInk,
              borderColor: ind.accent,
              opacity: exporting || totals.rows === 0 ? 0.5 : 1,
              cursor: exporting || totals.rows === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting
              ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
              : <Download size={13} strokeWidth={1.5} style={{ opacity: 0.85 }} />}
            <span style={{ ...figureStyle, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {`${t('reports.export', 'Export')} ${totals.rows.toLocaleString()} ${t('reports.records', 'records')}`}
            </span>
          </SpecularButton>
        </div>
      </div>

      {/* ── People with nothing in range ─────────────────────────────── */}
      {peopleListOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('reports.peopleWithoutRecords', 'People without records in range')}
          onClick={() => setPeopleListOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: ind.ground, border: `1px solid ${ind.hairline}`,
              width: 'min(460px, 100%)', maxHeight: '70vh', overflowY: 'auto', padding: '18px 20px',
            }}
          >
            <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 12 }}>
              <div>
                <ColumnHeading ind={ind}>{t('reports.peopleWithoutRecords', 'People without records in range')}</ColumnHeading>
                <p style={{ ...noteStyle, marginTop: 4 }}>{rangeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setPeopleListOpen(false)}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {peopleWithNoRecords.map((employee) => (
              <div
                key={employee.id}
                className="flex items-baseline justify-between"
                style={{ gap: 12, padding: '9px 0', borderTop: `1px solid ${ind.rule}` }}
              >
                <span style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, minWidth: 0 }}>
                  {getDemoEmployeeName(employee, t)}
                </span>
                <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, flex: 'none' }}>
                  {translateDepartment(employee.department)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
