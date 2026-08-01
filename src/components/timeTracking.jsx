import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Clock, Calendar, ArrowDownAZ, Users, X, Check, Pickaxe, Hourglass, ArrowUp01, Sailboat, Stamp, CircleQuestionMark, Funnel, ListFilterPlus, CalendarArrowDown, CalendarArrowUp, FileText, Coffee, CircleFadingArrowUp, Loader, BarChart3, PieChart, AlertCircle } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import * as timeTrackingService from '../services/timeTrackingService'
import { supabase } from '../config/supabaseClient'
import { AnimatedClockIcon } from './timeClockEntry'
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js'
import { getDemoEmployeeName, isDemoMode, addDemoLeaveRequest, updateDemoLeaveRequest, calculateDaysBetween } from '../utils/demoHelper'
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts'
import { SlidingNumber, useNumberReplay } from './motion-primitives';
import { PageLiveClock } from './ui/page-live-clock';
import { DatePicker } from './ui/date-picker.jsx';
import { filterActiveEmployees } from '../utils/employeeStatus.js';
import { COL } from '../utils/tableColumns.js';
import { TableScroll, StackedDetail } from './ui/responsive-table.jsx';
import { cn } from '@/lib/utils';
import { FlubberMorphIcon } from './ui/flubber-morph-icon.jsx';

function TimeCard({ title, value, unit, icon: Icon, color, onClick, useDarkIcon = false, iconProps = {}, text, border, isDarkMode, customIcons }) {
  const { replayToken, bump } = useNumberReplay();
  return (
    <div
      className={`group relative overflow-hidden rounded-lg p-6 border ${border.primary} ${onClick ? 'cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1' : ''}`}
      onClick={onClick}
      onMouseEnter={bump}
    >
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary}`}>{title}</p>
          <p className={`text-2xl font-bold ${color} mt-1`}>
            {typeof value === 'number' || (typeof value === 'string' && /^-?[\d.]+$/.test(String(value).trim())) ? (
              <SlidingNumber value={Number(value) || 0} replayToken={replayToken} />
            ) : (
              value
            )}
            <span className={`text-sm font-normal ${text.secondary} ml-1`}>{unit}</span>
          </p>
        </div>
        <div>
          {useDarkIcon && customIcons?.has(Icon) ? (
            <Icon className={`h-8 w-8 ${color}`} isDarkMode={isDarkMode} {...iconProps} />
          ) : (
            <Icon className={`h-8 w-8 ${color}`} aria-hidden="true" {...iconProps} />
          )}
        </div>
      </div>
    </div>
  );
}

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
                <line 
                    x1="6" 
                    y1="10" 
                    x2="6" 
                    y2="10" 
                    className="steam-line" 
                    style={{ animationDelay: '0.6s' }} 
                />
                
                {/* Steam Bar 2 (Center) - Instant start */}
                <line 
                    x1="9" 
                    y1="10" 
                    x2="9" 
                    y2="10" 
                    className="steam-line" 
                    style={{ animationDelay: '0s' }} 
                />
                
                {/* Steam Bar 3 (Right) - Heaviest delay */}
                <line 
                    x1="12" 
                    y1="10" 
                    x2="12" 
                    y2="10" 
                    className="steam-line" 
                    style={{ animationDelay: '1.2s' }} 
                />
                {/* Steam Bar 4 (Right) - Heaviest delay */}
                <line 
                    x1="15" 
                    y1="10" 
                    x2="15" 
                    y2="10" 
                    className="steam-line" 
                    style={{ animationDelay: '0.9s' }} 
                />
                
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

// Icons that take an `isDarkMode` prop rather than styling off `currentColor`.
const CUSTOM_ICONS = new Set([AnimatedCoffeeIcon, AnimatedClockIcon]);

const TimeTracking = ({ employees: employeesProp }) => {
  // Memoized because this array feeds the effect/callback dependency arrays
  // below: a fresh identity on every render restarts each fetch mid-flight,
  // which is what left the page stuck on its loading state.
  const employees = useMemo(() => filterActiveEmployees(employeesProp), [employeesProp]);
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();
  const { isDarkMode, bg, text, border, input } = useTheme();
  const { t } = useLanguage();
  
  // Check if user can view overview tab (admin/manager only)
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
      // Sorting state for overview table
      const [sortKey, setSortKey] = useState('employee');
      const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

      // Handle header click for sorting
      const handleSort = (key) => {
        if (sortKey === key) {
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
          setSortKey(key);
          setSortDirection('asc');
        }
      };
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed for Supabase
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // Add 'leaveRequests' tab for admin/manager
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'overview', 'leaveRequests'
  
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
  const overviewCacheRef = useRef({ key: '', data: [] });
  
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

  // Define fetch function that can be reused for visibility refresh
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
        setFetchError(error.message || 'Failed to load time tracking data. Please try refreshing.');
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

  // Fetch all leave requests for all employees (admin/manager only, when tab is open)
  const fetchAllLeaveRequests = useCallback(async () => {
    if (!canViewOverview || activeTab !== 'leaveRequests') {
      return;
    }

    try {
      // Scoped to the selected year like the Summary tab, but pending requests
      // are always included so approvals dated outside the year stay actionable.
      const result = await withTimeout(
        () => timeTrackingService.getAllLeaveRequests({
          year: selectedYear,
          alwaysIncludeStatus: 'pending',
        }),
        DEFAULT_REQUEST_TIMEOUT,
        'fetch all leave requests'
      );
      if (result.success && Array.isArray(result.data)) {
        setAllLeaveRequests(result.data);
      } else {
        setAllLeaveRequests([]);
      }
    } catch (error) {
      console.error('Error fetching all leave requests:', error);
      handleSessionAuthError(error, { silent: true });
      setAllLeaveRequests([]);
    }
  }, [canViewOverview, activeTab, selectedYear, withTimeout, handleSessionAuthError]);

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

  useEffect(() => {
    fetchAllLeaveRequests();
  }, [fetchAllLeaveRequests]);

  // Subscribe to leave request changes so approvals sync automatically
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
        setSuccessMessage(result.error || t('timeTracking.actionError', 'Error updating request'));
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
        setSuccessMessage(result.error || t('timeTracking.actionError', 'Error updating request'));
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
  
  // Fetch all employees data for Overview (single batched service call + cache)
  useEffect(() => {
    if (activeTab !== 'overview' || employees.length === 0) return undefined;

    const cacheKey = `${selectedYear}-${selectedMonth}-${employees.length}`;
    if (overviewCacheRef.current.key === cacheKey) {
      setAllEmployeesData(overviewCacheRef.current.data);
      return undefined;
    }

    let cancelled = false;
    setOverviewLoading(true);

    const fetchOverview = async () => {
      try {
        const result = await timeTrackingService.getOverviewEmployeeSummaries(
          selectedMonth,
          selectedYear,
          employees
        );
        if (cancelled || !result.success) return;

        overviewCacheRef.current = { key: cacheKey, data: result.data };
        setAllEmployeesData(result.data);
      } catch (error) {
        console.error('Error fetching overview data:', error);
        handleSessionAuthError(error, { silent: true });
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    };

    fetchOverview();
    return () => { cancelled = true; };
  }, [activeTab, selectedMonth, selectedYear, employees, handleSessionAuthError]);

  const sortedOverviewEmployees = useMemo(() => {
    const sorted = allEmployeesData.filter((item) => item.data);
    sorted.sort((a, b) => {
      let aValue;
      let bValue;
      switch (sortKey) {
        case 'employee':
          aValue = a.employee?.name?.toLowerCase() || '';
          bValue = b.employee?.name?.toLowerCase() || '';
          break;
        case 'days_worked':
          aValue = a.data?.days_worked || 0;
          bValue = b.data?.days_worked || 0;
          break;
        case 'regular_hours':
          aValue = a.data?.regular_hours || 0;
          bValue = b.data?.regular_hours || 0;
          break;
        case 'overtime':
          aValue = (a.data?.overtime_hours || 0) + (a.data?.holiday_overtime_hours || 0);
          bValue = (b.data?.overtime_hours || 0) + (b.data?.holiday_overtime_hours || 0);
          break;
        case 'total_hours':
          aValue = a.data?.total_hours || 0;
          bValue = b.data?.total_hours || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [allEmployeesData, sortKey, sortDirection]);

  const overviewChartStats = useMemo(() => {
    const withData = sortedOverviewEmployees.filter((item) => item.data);
    const maxRegularHours = Math.max(0, ...withData.map((item) => item.data?.regular_hours || 0));
    const maxOvertimeHours = Math.max(0, ...withData.map((item) =>
      (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0)
    ));
    return { withData, maxRegularHours, maxOvertimeHours };
  }, [sortedOverviewEmployees]);
  
  // Calculate leave days from leave_requests (including pending)
  const calculatedLeaveDays = useMemo(() => {
    if (!leaveRequests || leaveRequests.length === 0) return 0;

    return leaveRequests.reduce((total, req) => {
      // Include pending and approved, exclude rejected
      if (req.status === 'rejected') return total;
      
      const startDate = new Date(req.start_date);
      const reqMonth = startDate.getMonth() + 1;
      const reqYear = startDate.getFullYear();

      // Only count if within selected month/year
      if (reqYear === selectedYear && reqMonth === selectedMonth) {
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
      if (type === 'on_leave' || type === 'vacation' || type === 'sick_leave') return;
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

  // Attendance records alias (fix ReferenceError and expose timeEntries for the Summary table)
  const attendanceRecords = timeEntries || [];

  // Leave requests sorting helpers
  const handleLeaveSort = (key) => {
    if (leaveSortKey === key) {
      setLeaveSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLeaveSortKey(key);
      setLeaveSortDirection('asc');
    }
  };

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

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (aVal < bVal) return leaveSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return leaveSortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      if (aVal < bVal) return leaveSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return leaveSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [allLeaveRequests, leaveSortKey, leaveSortDirection]);

  const months = [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'), 
    t('months.may'), t('months.june'), t('months.july'), t('months.august'), 
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ];
  
  const getMonthName = (monthIndex) => {
    return months[monthIndex - 1] || months[0];
  };

  const years = [2023, 2024, 2025];

  // Handler functions
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
          leave_type: leaveForm.type || leaveForm.type,
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

        // If we're viewing leave requests for the current employee, update local list
        setLeaveRequests(prev => Array.isArray(prev) ? [...prev, newLeaveRequest] : [newLeaveRequest]);

        // Also add to allLeaveRequests (admin view) if relevant
        setAllLeaveRequests(prev => Array.isArray(prev) ? [...prev, newLeaveRequest] : [newLeaveRequest]);

        setSuccessMessage(t('timeTracking.leaveSuccess', 'Leave request submitted successfully!'));
        setShowLeaveModal(false);

        // Reset form
        setLeaveForm({
          type: 'vacation',
          startDate: '',
          endDate: '',
          reason: ''
        });

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
        const leaveResult = await timeTrackingService.getLeaveRequests(selectedEmployee, {
          year: selectedYear
        });
        if (leaveResult.success) {
          setLeaveRequests(leaveResult.data);
        }
        
        // Refresh summary to update leave days count
        const summaryResult = await timeTrackingService.getTimeTrackingSummary(
          selectedEmployee,
          selectedMonth,
          selectedYear
        );
        if (summaryResult.success) {
          setSummaryData(summaryResult.data);
        }
        
        // Reset form
        setLeaveForm({
          type: 'vacation',
          startDate: '',
          endDate: '',
          reason: ''
        });
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


  const hasOvertimeHours = useMemo(
    () => allEmployeesData.some((item) =>
      (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0) > 0
    ),
    [allEmployeesData]
  );

  const topRegularHourEmployees = useMemo(() => (
    [...overviewChartStats.withData]
      .sort((a, b) => (b.data?.regular_hours || 0) - (a.data?.regular_hours || 0))
      .slice(0, 10)
  ), [overviewChartStats.withData]);

  const topOvertimeEmployees = useMemo(() => (
    [...overviewChartStats.withData]
      .sort((a, b) => {
        const aTotal = (a.data?.overtime_hours || 0) + (a.data?.holiday_overtime_hours || 0);
        const bTotal = (b.data?.overtime_hours || 0) + (b.data?.holiday_overtime_hours || 0);
        return bTotal - aTotal;
      })
      .slice(0, 10)
  ), [overviewChartStats.withData]);

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className={`font-bold ${text.primary}`} style={{fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'}}>{t('timeTracking.title')}</h2>
          <PageLiveClock
            textClassName={text.primary}
            separatorClassName={text.secondary}
            loading={loading}
            isDarkMode={isDarkMode}
            fetchLabel={t('common.fetching', 'Fetching')}
          />
        </div>
       
        <div className="flex space-x-4">
          {/* Employee Selector */}
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(String(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'hover:bg-gray-500 hover:border-amber-50' : 'hover:bg-gray-100 hover:border-amber-800'}`}
          >
            {employees.map(employee => (
              <option key={employee.id} value={String(employee.id)}>
                {getDemoEmployeeName(employee, t)}
              </option>
            ))}
          </select>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'hover:bg-gray-500 hover:border-amber-50' : 'hover:bg-gray-100 hover:border-amber-800'}`}
          >
            {months.map((month, index) => (
              <option key={index + 1} value={index + 1}>
                {month}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`${input.bg} ${input.text} px-4 py-2 border ${input.border} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'hover:bg-gray-500 hover:border-amber-50' : 'hover:bg-gray-100 hover:border-amber-800'}`}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className={`${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-300'} rounded-lg border p-4 flex items-start space-x-3 slide-in-top`}>
          <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'} shrink-0 mt-0.5`} />
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>
              {t('common.error', 'Error')}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'} mt-1`}>
              {fetchError}
            </p>
            <button
              onClick={() => {
                setFetchError(null);
                fetchTimeTrackingData();
              }}
              className={`mt-2 text-xs font-medium ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} underline`}
            >
              {t('common.retry', 'Try Again')}
            </button>
          </div>
          <button
            onClick={() => setFetchError(null)}
            className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} transition-colors text-xl font-bold leading-none`}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Time Tracking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TimeCard
          title={t('timeTracking.workDays')}
          value={currentData.days_worked || 0}
          unit={t('timeTracking.days')}
          icon={Calendar}
          color={isDarkMode ? "text-white" : "text-black"}
          text={text}
          border={border}
          isDarkMode={isDarkMode}
          customIcons={CUSTOM_ICONS}
        />
        <TimeCard
          title={t('timeTracking.leaveDays')}
          value={calculatedLeaveDays.toFixed(0)}
          unit={t('timeTracking.days')}
          icon={AnimatedCoffeeIcon}
          useDarkIcon
          color={isDarkMode ? "text-white" : "text-black"}
          text={text}
          border={border}
          isDarkMode={isDarkMode}
          customIcons={CUSTOM_ICONS}
        />
        <TimeCard
          title={t('timeTracking.overtime')}
          value={(currentData.overtime_hours || 0) + (currentData.holiday_overtime_hours || 0)}
          unit={t('timeTracking.hours')}
          icon={AnimatedClockIcon}
          color={isDarkMode ? "text-white" : "text-black"}
          text={text}
          border={border}
          isDarkMode={isDarkMode}
          customIcons={CUSTOM_ICONS}
        />
      </div>

      {/* Tab Navigation */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-2`}>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-2 ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white'
                : `${text.secondary} hover:${bg.primary}`
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('timeTracking.summary', 'Summary')}</span>
          </button>
          {/* Only show overview tab for admin/manager */}
          {canViewOverview && (
            <>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-4 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center space-x-2 ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white'
                    : `${text.secondary} hover:${bg.primary}`
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t('timeTracking.overview', 'Overview')}</span>
              </button>
              <button
                onClick={() => setActiveTab('leaveRequests')}
                className={`flex-1 px-4 py-2 cursor-pointer rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                  activeTab === 'leaveRequests'
                    ? 'bg-blue-600 text-white'
                    : `${text.secondary} hover:${bg.primary}`
                }`}
              >
                <Coffee className="w-4 h-4" />
                <span>{t('timeTracking.leaveRequests', 'Leave Request Management')}</span>
              </button>
            </>
          )}
        </div>
      </div>

    {/* Summary Tab */}
    {activeTab === 'summary' && (
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('timeTracking.summary', `Summary for ${employees.find(emp => String(emp.id) === selectedEmployee)?.name} - ${getMonthName(selectedMonth)} ${selectedYear}`)}
          </h3>
          
          <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className={`${text.secondary} mr-12`}>{t('timeTracking.regularHours')}:</span>
                <span className={`font-medium ${text.primary}`}>{currentData.regular_hours || 0} {t('timeTracking.hrs')}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${text.secondary} mr-12`}>{t('timeTracking.overtimeHours')}:</span>
                <span className={`font-medium ${text.primary}`}>
                  {((currentData.overtime_hours || 0) + (currentData.holiday_overtime_hours || 0)).toFixed(1)} {t('timeTracking.hrs')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`${text.secondary} mr-12`}>{t('timeTracking.totalHours')}:</span>
                <span className={`font-medium ${text.primary}`}>{parseFloat(currentData.total_hours || 0).toFixed(1)} {t('timeTracking.hrs')}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className={`${text.secondary} ml-12`}>{t('timeTracking.workDays')}:</span>
                <span className={`font-medium ${text.primary}`}>{currentData.days_worked || 0} {t('timeTracking.days')}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${text.secondary} ml-12`}>{t('timeTracking.leaveDays')}:</span>
                <span className={`font-medium ${text.primary}`}>
                  {calculatedLeaveDays.toFixed(1)} {t('timeTracking.days')}
                  <span className="text-xs text-gray-500 ml-1">({t('timeTracking.includesPending', '*incl. pending')})</span>
                </span>
              </div>
              <div className={`flex justify-between border-t ${border.primary} pt-3`}>
                <span className={`${text.primary} font-semibold ml-12`}>{t('timeTracking.attendanceRate')}:</span>
                <span className={`font-bold ${text.primary}`}>
                  {(currentData.attendance_rate || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown Table */}
          <div className="mt-8">
            <h4 className={`text-md font-semibold ${text.primary} mb-4`}>
              {t('timeTracking.detailedBreakdown', 'Detailed Breakdown')}
            </h4>
            
            <TableScroll>
              <table className={`w-full border ${border.primary}`}>
                <thead className={`${bg.tertiary}`}>
                  <tr>
                    <th className={`${text.primary} py-3 px-4 text-center font-semibold border-b ${border.primary}`}>
                      {t('timeTracking.date', 'Date')}
                    </th>
                    <th className={cn(COL.lg, `${text.primary} py-3 px-4 text-center font-semibold border-b ${border.primary}`)}>
                      {t('timeTracking.employee', 'Employee')}
                    </th>
                    <th className={cn(COL.md, `${text.primary} py-3 px-4 text-center font-semibold border-b ${border.primary}`)}>
                      {t('timeTracking.time', 'Hours Worked')}
                    </th>
                    <th className={`${text.primary} py-3 px-4 text-center font-semibold border-b ${border.primary}`}>
                      {t('timeTracking.hourType', 'Hour Type')}
                    </th>
                    <th className={`${text.primary} py-3 px-4 text-right font-semibold border-b ${border.primary}`}>
                      {t('timeTracking.totalHours', 'Total Hours')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords && attendanceRecords.length > 0 ? (
                    attendanceRecords.map((record, index) => {
                      const recordEmployeeName = record.employee_name
                        || employees.find(emp => String(emp.id) === String(record.employee_id))?.name
                        || employees.find(emp => String(emp.id) === selectedEmployee)?.name
                        || '-';
                      const recordClockRange = (record.hour_type === 'on_leave' || record.hourType === 'on_leave')
                        ? '-'
                        : `${record.clock_in || record.clockIn} - ${record.clock_out || record.clockOut}`;

                      return (
                      <tr key={record.id || index} className={`border-b ${border.primary} ${isDarkMode ? 'hover:bg-blue-700' : 'hover:bg-amber-100'} group cursor-pointer transition-colors`}>
                        <td className={`p-3 ${text.primary} text-center font-medium`}>
                            {record.date || (record.created_at ? new Date(record.created_at).toLocaleDateString() : '-')}
                            {/* Stand-ins for the columns this viewport has dropped */}
                            <StackedDetail showUntil="md" label={t('timeTracking.time', 'Hours Worked')} value={recordClockRange} />
                            <StackedDetail showUntil="lg" label={t('timeTracking.employee', 'Employee')} value={recordEmployeeName} />
                          </td>
                        <td className={cn(COL.lg, `p-3 ${text.primary} text-center font-medium`)}>
                            {recordEmployeeName}
                        </td>
                        <td className={cn(COL.md, `p-3 text-center ${text.secondary}`)}>
                            {recordClockRange}
                        </td>
                        <td className={`${text.primary} py-3 px-4 text-center`}>
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium ${
                            (record.hour_type || record.hourType) === 'regular' ? (isDarkMode ? 'bg-blue-900/30 text-blue-400 group-hover:text-white' : 'bg-blue-200 text-blue-900 group-hover:text-black')  :
                            (record.hour_type || record.hourType) === 'holiday' ? (isDarkMode ? 'bg-purple-900/30 text-purple-400 group-hover:text-white' : 'bg-purple-200 text-purple-900 group-hover:text-black') :
                            (record.hour_type || record.hourType) === 'weekend' ? (isDarkMode ? 'bg-green-900/30 text-green-400 group-hover:text-white' : 'bg-green-200 text-green-900 group-hover:text-black') :
                            (record.hour_type || record.hourType) === 'on_leave' ? (isDarkMode ? 'bg-orange-900/30 text-orange-400 group-hover:text-white' : 'bg-orange-200 text-orange-900 group-hover:text-black') :
                            (isDarkMode ? 'bg-yellow-900/30 text-yellow-400 group-hover:text-white' : 'bg-yellow-200 text-yellow-900 group-hover:text-black')
                          }`}>
                            {t(`timeTracking.${record.hour_type || 'regular'}`, record.hour_type || 'regular')}
                          </span>
                        </td>
                        <td className={`p-3 text-center ${text.primary} font-semibold`}>
                          {record.hours} {t('timeClock.hrs')}
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className={`${text.secondary} py-8 px-4 text-center`}>
                        {t('timeTracking.noRecords', 'No attendance records found for this period')}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className={`${bg.tertiary} font-semibold`}>
                  <tr>
                    <td colSpan="4" className={`${text.primary} py-3 px-4 text-right border-t-2 ${border.primary}`}>
                      {t('timeTracking.daysWorked', 'Total Days')}:
                    </td>
                    <td className={`${text.primary} py-3 px-4 text-right border-t-2 ${border.primary}`}>
                      {attendanceRecords ? attendanceRecords.length : 0} {t('timeTracking.days')}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="4" className={`${text.primary} py-3 px-4 text-right border-t ${border.primary}`}>
                      {t('timeTracking.totalHours', 'Total Hours')}:
                    </td>
                    <td className={`${text.primary} py-3 px-4 text-right border-t ${border.primary}`}>
                      <span className={`font-medium ${text.primary}`}>{parseFloat(currentData.total_hours || 0).toFixed(1)} {t('timeTracking.hrs')}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6`}>
        <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
          {t('timeTracking.overviewTitle', 'Company Overview')} - {getMonthName(selectedMonth)} {selectedYear}
        </h3>

        {overviewLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
        <>
        {/* Regular Hours By Employee */}
        <div className={`grid grid-cols-1 ${hasOvertimeHours ? 'lg:grid-cols-2' : ''} gap-6 mb-6`}>
          <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className={`w-5 h-5 ${text.primary}`} />
              <h4 className={`font-semibold ${text.primary}`}>
                {t('timeTracking.regularHoursChart', 'Regular Hours by Employee')}
              </h4>
            </div>
            <div className="space-y-3">
              {topRegularHourEmployees.map((item) => {
                  const maxHours = overviewChartStats.maxRegularHours;
                  const percentage = maxHours > 0 ? ((item.data?.regular_hours || 0) / maxHours) * 100 : 0;
                  return (
                    <div key={item.employee.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={text.secondary}>{getDemoEmployeeName(item.employee, t)}</span>
                        <span className={text.primary}>{item.data?.regular_hours || 0} hrs</span>
                      </div>
                      <div className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className={`text-sm ${text.secondary}`}>{t('timeTracking.regularHoursLegend', 'Regular Hours')}</span>
              </div>
            </div>
          </div>

          {/* Total Overtime Hours By Employee */}
          {hasOvertimeHours && (
          <div className={`${bg.primary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center space-x-2 mb-4">
              <PieChart className={`w-5 h-5 ${text.primary}`} />
              <h4 className={`font-semibold ${text.primary}`}>
                {t('timeTracking.overtimeHoursChart', 'Overtime Hours by Employee')}
              </h4>
            </div>
            <div className="space-y-3">
              {topOvertimeEmployees.map((item) => {
                  const overtimeTotal = (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0);
                  const maxOT = overviewChartStats.maxOvertimeHours;
                  const percentage = maxOT > 0 ? (overtimeTotal / maxOT) * 100 : 0;
                  return (
                    <div key={item.employee.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={text.secondary}>{getDemoEmployeeName(item.employee, t)}</span>
                        <span className={text.primary}>{overtimeTotal.toFixed(1)} hrs</span>
                      </div>
                      <div className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                        <div
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-600 rounded"></div>
                <span className={`text-sm ${text.secondary}`}>{t('timeTracking.totalOvertimeLegend', 'Total Overtime')}</span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* All Employees Table */}
        <TableScroll>
          <table className="w-full">
            <thead>
              <tr className={`border-b ${border.primary}`}>
                <th
                  className={`text-left py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('employee')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.employee', 'Employee')}
                    <ArrowDownAZ
                      className={`inline w-4 h-4 ml-1 transition-all duration-500 ${sortKey === 'employee' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'employee' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                    />
                  </span>
                </th>
                <th
                  className={cn(COL.md, `text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`)}
                  onClick={() => handleSort('days_worked')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.daysWorked', 'Days Worked')}
                        {sortKey === 'days_worked' ? (
                      sortDirection === 'asc' ? (
                        <CalendarArrowUp
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                        />
                      ) : (
                        <CalendarArrowDown
                          className={`inline w-4 h-4 ml-1 transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                        />
                      )
                    ) : (
                      <CalendarArrowUp className="inline w-4 h-4 ml-1 transition-all duration-500 text-gray-400 hover:text-blue-400 hover:animate-pulse" />
                    )}
                  </span>
                </th>
                <th
                  className={cn(COL.lg, `text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`)}
                  onClick={() => handleSort('regular_hours')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.regularHours', 'Regular Hours')}
                    <CircleFadingArrowUp
                      className={`inline w-4 h-4  ml-1 transition-all duration-500 ${sortKey === 'regular_hours' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'regular_hours' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                    />
                  </span>
                </th>
                <th
                  className={cn(COL.lg, `text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`)}
                  onClick={() => handleSort('overtime')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('timeTracking.overtime', 'Overtime')}
                    <Pickaxe
                      className={`inline w-3 h-3 ml-1 transition-all duration-500 ${sortKey === 'overtime' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'overtime' && sortDirection === 'asc' ? 'rotate(90deg)' : 'none' }}
                    />
                  </span>
                </th>
                <th
                  className={`text-right py-3 px-4 ${text.primary} font-semibold cursor-pointer select-none`}
                  onClick={() => handleSort('total_hours')}
                >
                  <span className={`inline-flex items-center gap-1 `}>
                    {t('timeTracking.totalHoursLabel', 'Total Hours')}
                      <Hourglass
                      className={`inline w-3.5 h-3.5 ml-1 transition-all duration-500 ${sortKey === 'total_hours' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-blue-400 hover:animate-pulse'}`}
                      style={{transition: 'transform 0.5s', transform: sortKey === 'total_hours' && sortDirection === 'asc' ? 'rotate(180deg)' : 'none' }}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedOverviewEmployees.map((item) => {
                const overtimeTotal = (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0);
                const regularHours = item.data?.regular_hours?.toFixed(1) || '0.0';

                return (
                <tr key={item.employee.id}>
                  <td className={`text-left py-3 px-4 ${text.secondary}`}>
                    {getDemoEmployeeName(item.employee, t)}
                    {/* Stand-ins for the columns this viewport has dropped */}
                    <StackedDetail showUntil="md" label={t('timeTracking.daysWorked', 'Days Worked')} value={item.data?.days_worked || 0} />
                    <StackedDetail showUntil="lg" label={t('timeTracking.regularHours', 'Regular Hours')} value={regularHours} />
                    <StackedDetail showUntil="lg" label={t('timeTracking.overtime', 'Overtime')} value={overtimeTotal.toFixed(1)} />
                  </td>
                  <td className={cn(COL.md, `text-right py-3 px-4 ${text.secondary}`)}>{item.data?.days_worked || 0}</td>
                  <td className={cn(COL.lg, `text-right py-3 px-4 ${text.secondary}`)}>{regularHours}</td>
                  <td className={cn(COL.lg, `text-right py-3 px-4 ${text.secondary}`)}>{overtimeTotal.toFixed(1)}</td>
                  <td className={`text-right py-3 px-4 font-semibold ${text.primary}`}>{parseFloat(item.data?.total_hours || 0).toFixed(1)}</td>
                </tr>
                );
              })}
              <tr className={`border-t-2 ${border.primary} font-bold`}>
                <td className={`py-3 px-4 ${text.primary}`}>{t('dashboard.total', 'Total')}</td>
                <td className={cn(COL.md, `text-right py-3 px-4 ${text.primary}`)}>
                  {allEmployeesData.reduce((sum, item) => sum + (item.data?.days_worked || 0), 0)}
                </td>
                <td className={cn(COL.lg, `text-right py-3 px-4 ${text.primary}`)}>
                  {allEmployeesData.reduce((sum, item) => sum + (item.data?.regular_hours || 0), 0).toFixed(1)}
                </td>
                <td className={cn(COL.lg, `text-right py-3 px-4 ${text.primary}`)}>
                  {allEmployeesData.reduce((sum, item) =>
                    sum + (item.data?.overtime_hours || 0) + (item.data?.holiday_overtime_hours || 0), 0
                  ).toFixed(1)}
                </td>
                <td className={`text-right py-3 px-4 ${text.primary}`}>
                  {allEmployeesData.reduce((sum, item) => sum + (item.data?.total_hours || 0), 0).toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>

        </TableScroll>
        </>
        )}
      </div>
      )}

      {/* Leave Requests Tab (moved out of overview) */}
      {activeTab === 'leaveRequests' && canViewOverview && (
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mt-6`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>{t('timeTracking.leaveRequestManagement', 'Leave Request Management')}</h3>
          <div className="mt-2">
            <TableScroll>
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${border.primary}`}>
                    <th className={`${text.primary} py-2 px-4 text-left cursor-pointer`} onClick={() => handleLeaveSort('days_count')}>
                      <span className="inline-flex items-center gap-1">
                        {t('timeTracking.leaveDays', 'Leave Days')}
                        <ArrowUp01 className={`inline w-4 h-4 ml-1 transition-all duration-500 ${leaveSortKey === 'days_count' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-amber-400 hover:animate-pulse'}`} style={{ transform: leaveSortKey === 'days_count' && leaveSortDirection === 'asc' ? 'rotate(180deg)' : 'none' }} />
                      </span>
                    </th>
                    <th className={cn(COL.md, `${text.primary} py-2 px-4 text-left cursor-pointer`)} onClick={() => handleLeaveSort('leave_type')}>
                      <span className="inline-flex items-center gap-1">
                        {t('timeTracking.leaveType', 'Leave Type')}
                        <Sailboat className={`inline w-4 h-4 ml-1 transition-all duration-500 ${leaveSortKey === 'leave_type' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-amber-400 hover:animate-pulse'}`} style={{ transform: leaveSortKey === 'leave_type' && leaveSortDirection === 'asc' ? 'rotateY(180deg)' : 'none' }} />
                      </span>
                    </th>
                    <th className={`${text.primary} py-2 px-4 text-left cursor-pointer`} onClick={() => handleLeaveSort('status')}>
                      <span className="inline-flex items-center gap-1">
                        {t('common.status', 'Status')}
                        <ListFilterPlus className={`inline w-4.5 h-4.5 ml-1 transition-all duration-500 ${leaveSortKey === 'status' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-amber-400 hover:animate-pulse'}`} style={{ transform: leaveSortKey === 'status' && leaveSortDirection === 'asc' ? 'rotateY(180deg)' : 'none' }} />
                      </span>
                    </th>
                    <th className={`${text.primary} py-2 px-4 text-left cursor-pointer`} onClick={() => handleLeaveSort('requested_by')}>
                      <span className="inline-flex items-center gap-1">
                        {t('timeTracking.requestedBy', 'Requested By')}
                        <ArrowDownAZ className={`inline w-4 h-4 ml-1 transition-all duration-500 ${leaveSortKey === 'requested_by' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-amber-400 hover:animate-pulse'}`} style={{ transform: leaveSortKey === 'requested_by' && leaveSortDirection === 'asc' ? 'rotate(180deg)' : 'none' }} />
                      </span>
                    </th>
                    <th className={`${text.primary} py-2 px-4 text-left cursor-pointer`} onClick={() => handleLeaveSort('approved_by')}>
                      <span className="inline-flex items-center gap-1">
                        {t('timeTracking.approvedBy', 'Approved By')}
                        <Stamp className={`inline w-4 h-4 ml-1 transition-all duration-500 ${leaveSortKey === 'approved_by' ? (isDarkMode ? 'text-white' : 'text-black') : 'text-gray-400 hover:text-amber-400 hover:animate-pulse'}`} style={{ transform: leaveSortKey === 'approved_by' && leaveSortDirection === 'asc' ? 'rotateY(180deg)' : 'none' }} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allLeaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-500">
                        {t('leave.noRequests', 'No leave requests yet.')}
                      </td>
                    </tr>
                  ) : (
                    sortedLeaveRequests.map((req, idx) => {
                      const leaveTypeLabel = (() => {
                        switch (req.leave_type) {
                          case 'sick': return t('timeTracking.sickLeave', 'Sick Leave');
                          case 'vacation': return t('timeTracking.vacation', 'Vacation');
                          case 'personal': return t('timeTracking.personal', 'Personal Leave');
                          case 'unpaid': return t('timeTracking.unpaid', 'Unpaid Leave');
                          default: return req.leave_type || '-';
                        }
                      })();

                      return (
                      <tr key={req.id || idx}>
                        <td className={`${text.primary} py-2 px-4 text-center`}>{req.days_count}</td>
                        <td className={cn(COL.md, `${text.primary} py-2 px-4`)}>{leaveTypeLabel}</td>
                        <td className={`${text.primary} py-2 px-4`}>
                          <div className="flex items-center justify-between">
                            <span>{t(`timeTracking.${req.status}`, req.status)}</span>
                            <MiniFlubberMorphingLeaveStatus isDarkMode={isDarkMode} status={req.status} size={20} className={`${text.primary} ml-4`} />
                          </div>
                        </td>
                        <td className={`${text.primary} py-2 px-4`}>
                          {req.employee?.name || '-'}
                          {/* Stand-in for the column this viewport has dropped */}
                          <StackedDetail showUntil="md" label={t('timeTracking.leaveType', 'Leave Type')} value={leaveTypeLabel} />
                        </td>
                        <td className={`${text.primary} py-2 px-4 flex justify-center items-center gap-2`}>
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveRequest(req.id)}
                                disabled={!!processingRequests[req.id]}
                                title={t('timeTracking.approve', 'Approve')}
                                className={`text-green-600 hover:animate-pulse ${isDarkMode ? 'hover:bg-gray-100' : 'hover:bg-gray-700'} rounded-4xl hover:scale-120 transition-all duration-500 ${processingRequests[req.id] ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={!!processingRequests[req.id]}
                                title={t('timeTracking.reject', 'Reject')}
                                className={`text-red-600 -translate-y-px hover:scale-120 hover:rotate-180 transition-transform duration-1500 ${isDarkMode ? 'hover:bg-gray-200' : 'hover:bg-gray-300'} rounded-4xl ${processingRequests[req.id] ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            req.approved_by_name || '-'
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <Check className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bg.secondary} rounded-lg shadow-xl max-w-md w-full p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${text.primary}`}>
                {t('timeTracking.requestLeave', 'Request Leave')}
              </h3>
              <button onClick={() => setShowLeaveModal(false)} className={`${text.secondary} hover:${text.primary}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.leaveType', 'Leave Type')}
                </label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                >
                  <option value="vacation">{t('timeTracking.vacation', 'Vacation')}</option>
                  <option value="sick">{t('timeTracking.sickLeave', 'Sick Leave')}</option>
                  <option value="personal">{t('timeTracking.personal', 'Personal Leave')}</option>
                  <option value="unpaid">{t('timeTracking.unpaid', 'Unpaid Leave')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('timeTracking.startDate', 'Start Date')}
                  </label>
                  <DatePicker
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    required
                    inputClassName={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('timeTracking.endDate', 'End Date')}
                  </label>
                  <DatePicker
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    required
                    inputClassName={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('timeTracking.reason', 'Reason')}
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows="3"
                  placeholder={t('timeTracking.reasonPlaceholder', 'Briefly explain your leave request...')}
                  className={`w-full px-4 py-2 rounded-lg border ${input.className}`}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className={`flex-1 px-4 py-2 border ${isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'} rounded-lg transition-colors`}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
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
