/**
 * 3a — Chấm công / Time clock entry. Hours entered after the fact.
 *
 * The on-site counterpart is 3d (punchClock.jsx), which punches live. The two
 * are deliberately not merged: 3a is a form with proof upload and an approval
 * queue, 3d is a single dominant punch.
 *
 * The read, top to bottom:
 *   ticker     — the six figures that never move, so you can scan them
 *   page head  — what you are looking at, plus the scope switch
 *   entry form — one blueprint. Left half collects the entry, the 212px right
 *                half is the consequence: hours this will file, what the week
 *                becomes, and the only two buttons on the card.
 *   history    — the eight-column ledger, inline-editable, with the approve /
 *                proof / delete actions on the row they belong to.
 *   right rail — week, month and leave totals, plus the bulk entry point.
 *
 * Layout rules that are load-bearing, not taste:
 *   - The ticker is a sibling of the two bands, never a child of one. It has to
 *     span both columns.
 *   - `min-w-0` on the left band and on the pane inside it. Without it the
 *     eight-column table refuses to shrink and pushes the right rail off-screen.
 *   - The right rail is 372px. 340 (3d's width) is too narrow for the hour-type
 *     breakdown, which carries a label, a figure and a bar on one line.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius 0, cards are
 * outlines with four registration corners, status reads through weight and rule
 * rather than red/green.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  AlertCircle, Calendar, Check, Clock, FileCheck, Loader2, Pencil, Search, Upload, Users, X,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as timeTrackingService from '../services/timeTrackingService.js';
import { validateAndRefreshSession } from '../utils/sessionHelper.js';
import { retryWithBackoff, isRetryableError } from '../utils/retryHelper.js';
import { DEFAULT_REQUEST_TIMEOUT } from '../config/requestTimeouts.js';
import { supabase } from '../config/supabaseClient.js';
import { isDemoMode, getDemoEmployeeName, addDemoLeaveRequest, calculateDaysBetween } from '../utils/demoHelper.js';
import AdminTimeEntry from './AdminTimeEntry.jsx';
import { motion } from 'framer-motion';
import { useSessionGuard, useAuthenticatedPageRefresh } from '../hooks/useSessionGuard.js';
import { useSearchParams } from 'react-router-dom';
import { DatePicker } from './ui/date-picker.jsx';
import { TimePicker } from './ui/time-picker.jsx';
import { COL } from '../utils/tableColumns.js';
import { TableScroll, StackedDetail } from './ui/responsive-table.jsx';
import { cn } from '@/lib/utils';
import { useNotifications } from '../contexts/NotificationContext';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import {
  Blueprint, Bar, Tag, Btn, Seg, Kicker, ColumnHeading, TickerCell, LiveClock, FlatSelect,
} from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import { formatDate } from '../utils/localeFormat.js';
import {
  getHoursWorked,
  toExtendedInterval,
  extendedIntervalsOverlap,
} from '../utils/timeEntryHelpers.js';

/** A full-time week. The rail's "còn lại" figure is measured against this. */
const CONTRACT_WEEK_HOURS = 40;

/**
 * A sortable column head. The direction reads as a caret in the label's own
 * type rather than an icon, so the header row stays one typographic object.
 */
function SortableTh({ ind, active, dir, onClick, style, className, children }) {
  return (
    <th className={className} style={style}>
      <button
        type="button"
        onClick={onClick}
        style={{
          font: 'inherit', color: active ? ind.ink : 'inherit', letterSpacing: 'inherit',
          textTransform: 'inherit', background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        {children}
        <span aria-hidden="true" style={{ opacity: active ? 1 : 0.35 }}>
          {active && dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}
/** The shift the "fill" button writes when you cannot be bothered to type it. */
const STANDARD_CLOCK_IN = '09:00';
const STANDARD_CLOCK_OUT = '17:00';

export const AnimatedAlarmClockIcon = ({ className }) => {
  const clockBodyPath = "M32.48,104.77l-9.72,16.68c-0.4,0.68-1.03,1.14-1.74,1.33c-0.71,0.19-1.49,0.11-2.17-0.29c-0.68-0.4-1.14-1.03-1.33-1.74 c-0.19-0.71-0.11-1.49,0.29-2.17l10.15-17.4c-2.27-2.03-4.35-4.28-6.2-6.7c-2.01-2.63-3.75-5.47-5.2-8.49 c-1.54-3.21-2.73-6.61-3.54-10.16c-0.78-3.45-1.2-7.04-1.2-10.71c0-6.55,1.3-12.79,3.67-18.5c2.46-5.93,6.05-11.26,10.51-15.71 c4.46-4.46,9.79-8.05,15.71-10.51c5.7-2.36,11.95-3.67,18.5-3.67c6.55,0,12.8,1.3,18.5,3.67c5.93,2.45,11.26,6.05,15.71,10.5 c4.46,4.46,8.05,9.79,10.5,15.71c2.36,5.7,3.67,11.95,3.67,18.5c0,6.55-1.3,12.8-3.67,18.5c-2.46,5.93-6.05,11.26-10.5,15.71 c-0.39,0.39-0.82,0.8-1.28,1.23c-0.22,0.21-0.45,0.42-0.69,0.63l10.14,17.39c0.4,0.68,0.48,1.46,0.29,2.17 c-0.19,0.71-0.65,1.35-1.33,1.74c-0.68,0.4-1.46,0.48-2.17,0.29c-0.71-0.19-1.35-0.65-1.74-1.33l-9.72-16.67 c-3.84,2.69-8.1,4.84-12.65,6.33c-4.75,1.55-9.81,2.4-15.07,2.4c-2.76,0-5.48-0.24-8.14-0.69c-2.71-0.46-5.35-1.15-7.89-2.04 c-2.27-0.8-4.45-1.75-6.54-2.86C35.84,106.97,34.12,105.92,32.48,104.77L32.48,104.77z M56.22,39.63c0-0.79,0.32-1.5,0.84-2.03 l0.01-0.01c0.52-0.52,1.24-0.84,2.02-0.84c0.79,0,1.51,0.32,2.03,0.84l0,0c0.52,0.52,0.84,1.24,0.84,2.03v27.44h26.35 c0.79,0,1.51,0.32,2.03,0.84c0.02,0.02,0.04,0.05,0.06,0.07c0.48,0.52,0.78,1.21,0.78,1.96c0,0.79-0.32,1.5-0.84,2.03l-0.01,0.01 c-0.52,0.52-1.24,0.84-2.02,0.84H59.09c-0.79,0-1.5-0.32-2.03-0.84l-0.01-0.01c-0.52-0.52-0.84-1.24-0.84-2.02V39.63L56.22,39.63z M90.35,34.97c-3.94-3.94-8.63-7.1-13.84-9.26c-5.02-2.08-10.53-3.23-16.31-3.23S48.9,23.63,43.88,25.7 c-5.21,2.16-9.91,5.33-13.84,9.26c-3.94,3.94-7.1,8.63-9.26,13.84c-2.08,5.02-3.23,10.53-3.23,16.31c0,3.26,0.36,6.43,1.05,9.46 c0.71,3.13,1.75,6.12,3.1,8.94c1.38,2.87,3.07,5.58,5.04,8.06c1.98,2.5,4.24,4.77,6.72,6.77l0.06,0.05 c1.87,1.5,3.87,2.85,5.98,4.02c2.08,1.16,4.27,2.15,6.55,2.95c2.23,0.78,4.55,1.39,6.94,1.79c2.33,0.39,4.74,0.6,7.2,0.6 c5.78,0,11.29-1.15,16.31-3.23c5.21-2.16,9.91-5.33,13.84-9.26c3.94-3.94,7.1-8.63,9.26-13.84c2.08-5.02,3.23-10.53,3.23-16.31 s-1.15-11.29-3.23-16.31C97.45,43.6,94.28,38.9,90.35,34.97L90.35,34.97z M120.59,24.92c0,1.72-0.21,3.4-0.61,5.03 c-0.41,1.67-1.02,3.27-1.8,4.78c-0.79,1.53-1.76,2.97-2.89,4.31c-1.13,1.34-2.42,2.57-3.85,3.67c-0.63,0.48-1.39,0.67-2.11,0.57 c-0.73-0.09-1.42-0.46-1.9-1.09c-0.1-0.13-0.19-0.27-0.27-0.41c-0.07-0.13-0.13-0.27-0.18-0.4l-0.02-0.05 c-1.13-3.43-2.63-6.7-4.45-9.74c-1.85-3.09-4.04-5.95-6.52-8.54c-2.48-2.59-5.24-4.91-8.24-6.9c-2.96-1.97-6.16-3.62-9.53-4.9 c-0.74-0.28-1.3-0.83-1.6-1.5c-0.3-0.67-0.35-1.45-0.07-2.19c0.12-0.31,0.29-0.6,0.49-0.84c0.21-0.25,0.47-0.47,0.74-0.63 l0.01-0.01c2.26-1.51,4.78-2.64,7.42-3.4c2.76-0.79,5.67-1.19,8.57-1.19c2.24,0,4.5,0.24,6.7,0.7c2.18,0.46,4.29,1.14,6.27,2.04 c2.08,0.95,4.03,2.13,5.76,3.55c1.66,1.36,3.14,2.95,4.37,4.76c1.19,1.76,2.14,3.7,2.77,5.82 C120.26,20.4,120.59,22.58,120.59,24.92L120.59,24.92z M113.08,32.1c0.58-1.11,1.02-2.29,1.32-3.51c0.29-1.18,0.44-2.41,0.44-3.68 c0-1.77-0.24-3.4-0.68-4.89c-0.46-1.57-1.15-2.99-2.01-4.26c-0.91-1.34-2.02-2.53-3.29-3.56c-1.33-1.08-2.84-2-4.46-2.73 c-1.61-0.73-3.33-1.29-5.1-1.66c-1.79-0.38-3.65-0.57-5.51-0.57c-1.77,0-3.51,0.17-5.2,0.51c-0.89,0.18-1.77,0.41-2.62,0.69 c2.29,1.19,4.48,2.54,6.57,4.04c2.74,1.96,5.28,4.18,7.6,6.6c2.45,2.56,4.64,5.36,6.55,8.35c1.6,2.51,2.99,5.17,4.17,7.96 c0.27-0.32,0.53-0.65,0.78-0.98C112.18,33.68,112.66,32.91,113.08,32.1L113.08,32.1z M40.01,13.52c-3.43,1.13-6.7,2.63-9.74,4.45 c-3.09,1.85-5.95,4.04-8.54,6.52c-2.59,2.48-4.91,5.24-6.9,8.24c-1.97,2.96-3.62,6.16-4.9,9.53c-0.28,0.74-0.83,1.3-1.5,1.6 c-0.67,0.3-1.45,0.35-2.19,0.07c-0.31-0.12-0.59-0.28-0.83-0.49c-0.24-0.2-0.44-0.44-0.6-0.7c-0.77-1.14-1.46-2.36-2.06-3.63 c-0.6-1.27-1.1-2.59-1.51-3.94c-0.41-1.36-0.72-2.77-0.93-4.22C0.11,29.52,0,28.07,0,26.6c0-3.19,0.53-6.22,1.48-9.02 c1.01-2.96,2.49-5.65,4.31-8c1.42-1.83,3.05-3.43,4.82-4.78c1.79-1.36,3.73-2.47,5.76-3.27c2.1-0.83,4.3-1.34,6.53-1.49 c2.16-0.14,4.34,0.05,6.5,0.63c2.23,0.6,4.42,1.6,6.5,3.06c1.95,1.37,3.8,3.13,5.49,5.32c0.48,0.63,0.67,1.39,0.57,2.11 c-0.09,0.73-0.46,1.42-1.09,1.9c-0.13,0.1-0.27,0.19-0.41,0.27c-0.13,0.07-0.27,0.13-0.4,0.18L40.01,13.52L40.01,13.52z M17.78,20.34c2.56-2.45,5.36-4.65,8.36-6.55c2.52-1.6,5.19-3,7.98-4.18c-0.77-0.68-1.56-1.26-2.37-1.75 c-1.24-0.75-2.53-1.3-3.84-1.65c-1.54-0.41-3.11-0.55-4.67-0.45c-1.62,0.11-3.22,0.49-4.77,1.1c-1.56,0.62-3.05,1.46-4.43,2.51 c-1.38,1.05-2.65,2.3-3.75,3.72c-1.43,1.84-2.6,3.97-3.39,6.32c-0.75,2.21-1.17,4.63-1.17,7.18c0,1.21,0.09,2.39,0.25,3.53 c0.17,1.17,0.42,2.3,0.75,3.4c0.11,0.37,0.23,0.73,0.35,1.08c1.2-2.32,2.56-4.54,4.07-6.64C13.12,25.22,15.34,22.67,17.78,20.34 L17.78,20.34z"; 
  const clockHandPath = "M56.22,39.63c0-0.79,0.32-1.5,0.84-2.03 l0.01-0.01c0.52-0.52,1.24-0.84,2.02-0.84c0.79,0,1.51,0.32,2.03,0.84l0,0c0.52,0.52,0.84,1.24,0.84,2.03v18.52";

  return (
    <svg 
      className={className}
      viewBox="-1.14 0 122.88 122.88" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 1. Clock Body (Static) */}
      <path 
        d={clockBodyPath} 
        stroke="currentColor" 
        fill="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{
            originX: 0,
            originY: 0,
            transformBox: "fill-box",
          }}
      />
      
      {/* 2. Clock Hand (Animated) */}
      <motion.path 
        d={clockHandPath} 
        stroke="currentColor"
        fill="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ rotate: 360 }}
        transition={{ 
          repeat: Infinity, 
          duration: 8,    
          ease: "linear",
        }}
        
        style={{ originX: '7.5px', originY: '30px', transformBox: "fill-box", }} 
      />
    </svg>
  )
};

// Animated Clock 2
export const AnimatedClockIcon = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />

      {/* Translate coordinate system so (0,0) = clock center */}
      <g transform="translate(12.5, 18.5)">

        {/* Hour hand – slow rotation */}
        <motion.path
          d="M0 0L0 -5.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            originX: 0,
            originY: 0,
            transformBox: "fill-box",
          }}
        />

        {/* Minute hand – faster rotation */}
        <motion.path
          d="M0 0L0 -7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{
            originX: 0,
            originY: 0,
            transformBox: "fill-box",
          }}       
        />
      </g>
    </svg>
  );
};

const TimeClockEntry = () => {
  const { isDarkMode } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { user } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();
  const { checkPendingApprovals } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = user?.id || null;
  const userEmployeeId = user?.employee_id || user?.employeeId || null;
  const userRole = user?.role || null;
  // Check if user can manage time tracking (admin, manager, or demo admin)
  const canManageTimeTracking =
    userRole === 'admin' || userRole === 'manager' || userRole === 'demo_admin';

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    hourType: 'regular',
    notes: '',
    proofFile: null
  });

  // Time entries state
  const [timeEntries, setTimeEntries] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for uploading proof to existing entries
  const [uploadingProofId, setUploadingProofId] = useState(null);
  const [uploadToast, setUploadToast] = useState({ show: false, message: '', type: '' });
  const [uploadProgress, setUploadProgress] = useState({});
  
  // State for image preview modal
  const [imagePreview, setImagePreview] = useState({ show: false, url: '' });
  
  // State for employee filtering and approval
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState(canManageTimeTracking ? 'all' : 'self');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewMode, setReviewMode] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [approvingEntryId, setApprovingEntryId] = useState(null);
  const historySectionRef = useRef(null);
  const reviewScrollDoneRef = useRef(false);
  
  // Sorting state for history table
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    clockIn: '',
    clockOut: '',
    hours: '',
    hourType: 'regular',
  });
  const [savingEntryId, setSavingEntryId] = useState(null);
  
  // Handle header click for sorting
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };
  
  // Sorting function for history table (moved below to ensure leave data exists)
  
  // Leave request form
  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: ''
  });
  
  // Get the current employeeId for leave requests
  const getCurrentEmployeeId = () => {
    if (userEmployeeId) return userEmployeeId;
    if (userId) return userId;
    return null;
  };
  const [selectedEmployee] = useState(getCurrentEmployeeId());

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

   const handleLeaveSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      
      try {
        // Demo mode: save leave request locally
        if (isDemoMode()) {
          const daysCount = calculateDaysBetween(leaveForm.startDate, leaveForm.endDate);
          const newLeaveRequest = {
            id: `demo-leave-${Date.now()}`,
            employee_id: selectedEmployee,
            type: leaveForm.type,
            start_date: leaveForm.startDate,
            end_date: leaveForm.endDate,
            reason: leaveForm.reason,
            days_count: daysCount,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Add to persistent storage
          addDemoLeaveRequest(newLeaveRequest);
          
          // Update local state immediately
          setLeaveRequests(prev => [...prev, newLeaveRequest]);
          
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

          // Keep local-only representation so UI can show the request without pulling from Supabase
          const newLeaveRequest = {
            id: result.data?.id || `local-leave-${Date.now()}`,
            employee_id: selectedEmployee,
            leave_type: leaveForm.type,
            type: leaveForm.type,
            start_date: leaveForm.startDate,
            end_date: leaveForm.endDate,
            reason: leaveForm.reason,
            status: result.data?.status || 'pending',
            created_at: result.data?.created_at || new Date().toISOString(),
            updated_at: result.data?.updated_at || new Date().toISOString()
          };
          setLeaveRequests((prev) => [...prev, newLeaveRequest]);

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
  
  // Define loadData as a callback for reuse
  const loadInFlight = useRef(false);
  const loadSafetyTimer = useRef(null);
  const isMounted = useRef(true);
  const loadSeq = useRef(0);

  // Normalize entries so on-leave rows don't show placeholder times
  const normalizeEntries = useCallback((entries) =>
    Array.isArray(entries)
      ? entries.map((entry) =>
          entry?.hour_type === 'on_leave'
            ? { ...entry, clock_in: null, clock_out: null, hours: 0 }
            : entry
        )
      : [], []);

  // Fetch time entries from Supabase
  const fetchTimeEntries = useCallback(async () => {
    console.log('🔄 fetchTimeEntries called');
    try {
      let result;
     
      if (canManageTimeTracking) {
        console.log('👤 User is admin/manager, fetching all entries detailed');
        result = await withTimeout(
          () => timeTrackingService.getAllTimeEntriesDetailed(),
            DEFAULT_REQUEST_TIMEOUT,
          'fetch time entries (all)'
        );
        
        if (result?.success && Array.isArray(result.data)) {
          console.log('✅ Fetched', result.data.length, 'entries');
          setTimeEntries(normalizeEntries(result.data));
        } else {
          console.error('❌ Failed to load entries:', result?.error || 'No data returned');
          setTimeEntries([]);
        }
      } else {
        console.log('👤 User is regular employee, fetching own entries');
        if (userEmployeeId) {
          result = await withTimeout(
            () => timeTrackingService.getTimeEntries(userEmployeeId),
            DEFAULT_REQUEST_TIMEOUT,
            'fetch time entries (self)'
          );
          if (result?.success && Array.isArray(result.data)) {
            console.log('✅ Fetched', result.data.length, 'entries');
            setTimeEntries(normalizeEntries(result.data));
          } else {
            console.error('❌ Failed to load entries:', result?.error || 'No data returned');
            setTimeEntries([]);
          }
        } else {
          console.warn('⚠️ No employee ID found for user');
          setTimeEntries([]);
        }
      }
    } catch (error) {
      console.error('💥 Exception in fetchTimeEntries:', error);
      console.error('Stack:', error.stack);
      handleSessionAuthError(error, { silent: true });
      setTimeEntries([]); // Ensure it's an empty array on error
    }
  }, [canManageTimeTracking, userEmployeeId, withTimeout, normalizeEntries]);

  const fetchAllEmployees = useCallback(async () => {
    try {
      if (isDemoMode()) {
        setAllEmployees([
          { id: 'demo-emp-1', name: 'Demo Admin', position: 'HR Manager', department: 'Management' },
          { id: 'demo-emp-2', name: 'Sarah Connor', position: 'Developer', department: 'Operations' },
          { id: 'demo-emp-3', name: 'John Doe', position: 'Manager', department: 'IT' },
          { id: 'demo-emp-4', name: 'Emily Chen', position: 'Designer', department: 'Design' },
          { id: 'demo-emp-5', name: 'Michael Brown', position: 'Analyst', department: 'Finance' }
        ]);
        return;
      }

      const { data, error } = await withTimeout(
        () =>
          supabase
            .from('employees')
            .select('id, name, position, department')
            .eq('status', 'Active')
            .order('name'),
        DEFAULT_REQUEST_TIMEOUT,
        'fetch employees'
      );
      
      if (error) throw error;
      setAllEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      handleSessionAuthError(error, { silent: true });
    }
  }, [withTimeout, handleSessionAuthError]);

  const fetchLeaveRequests = useCallback(async ({ year } = {}) => {
    try {
      if (isDemoMode()) {
        setLeaveRequests([]);
        return;
      }

      if (!userEmployeeId) {
        setLeaveRequests([]);
        return;
      }

      const currentYear = year || new Date().getFullYear();
      const result = await withTimeout(
        () => timeTrackingService.getLeaveRequests(userEmployeeId, { year: currentYear }),
        DEFAULT_REQUEST_TIMEOUT,
        'fetch leave requests'
      );

      if (result?.success && Array.isArray(result.data)) {
        setLeaveRequests(result.data);
      } else {
        if (import.meta?.env?.DEV) console.log('No leave requests returned or error:', result?.error);
        setLeaveRequests([]);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      handleSessionAuthError(error, { silent: true });
      setLeaveRequests([]);
    }
  }, [userEmployeeId, withTimeout, handleSessionAuthError]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    const seq = ++loadSeq.current;
    if (import.meta?.env?.DEV) {
      console.log(`[TimeClockEntry] loadData start #${seq}`, {
        silent,
        userId,
        canManageTimeTracking,
        inFlight: loadInFlight.current,
      });
    }

    if (loadInFlight.current || !isMounted.current) {
      if (import.meta?.env?.DEV) console.log(`[TimeClockEntry] loadData skip #${seq}`);
      return;
    }
    loadInFlight.current = true;

    if (loadSafetyTimer.current) {
      clearTimeout(loadSafetyTimer.current);
      loadSafetyTimer.current = null;
    }

    if (userId && !silent && isMounted.current) {
      setLoading(true);
      setFetchError(null); // Clear any previous errors
    }
    if (!userId) {
      // No user available yet; clear loading so UI does not hang
      if (isMounted.current) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
      loadInFlight.current = false;
      if (import.meta?.env?.DEV) console.log(`[TimeClockEntry] loadData no-user exit #${seq}`);
      return;
    }

    if (!silent && userId) {
      loadSafetyTimer.current = setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
          setInitialLoadComplete(true);
        }
        loadSafetyTimer.current = null;
        loadInFlight.current = false;
      }, DEFAULT_REQUEST_TIMEOUT);
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
      
      // Wrap fetch with retry mechanism
      await retryWithBackoff(async () => {
        await fetchTimeEntries();
        if (import.meta?.env?.DEV) console.log(`[TimeClockEntry] loadData fetched entries #${seq}`);
      Promise.resolve(fetchLeaveRequests()).then(() => {
        if (import.meta?.env?.DEV) console.log(`[TimeClockEntry] leave requests fetched #${seq}`);
      }).catch((e) => {
        console.error('Error fetching leave requests (background):', e);
      });

      if (canManageTimeTracking) {
        Promise.resolve(fetchAllEmployees())
          .then(() => {
            if (import.meta?.env?.DEV) console.log(`[TimeClockEntry] background employee fetch done #${seq}`);
          })
          .catch((e) => {
            console.error('Error fetching employees (background):', e);
          });
      }
      }, {
        maxRetries: 2,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt, delay) => {
          console.log(`🔄 TimeClockEntry: Retrying fetch (${attempt}/2) after ${delay}ms...`);
        }
      });
    } catch (error) {
      console.error('Error loading data:', error);

      if (handleSessionAuthError(error, { silent, setFetchError })) {
        loadInFlight.current = false;
        return;
      }
      
      // Set user-visible error message for other errors
      if (!silent && isMounted.current) {
        setFetchError(error.message || 'Failed to load time tracking data. Please try refreshing the page.');
      }
    } finally {
      if (loadSafetyTimer.current) {
        clearTimeout(loadSafetyTimer.current);
        loadSafetyTimer.current = null;
      }
      if (isMounted.current) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
      loadInFlight.current = false;
      if (import.meta?.env?.DEV) {
        console.log(`[TimeClockEntry] loadData done #${seq}`, {
          loadingCleared: true,
        });
      }
    }
  }, [userId, canManageTimeTracking, fetchTimeEntries, fetchLeaveRequests, fetchAllEmployees, handleSessionAuthError]);

  useEffect(() => () => {
    isMounted.current = false;
    if (loadSafetyTimer.current) {
      clearTimeout(loadSafetyTimer.current);
      loadSafetyTimer.current = null;
    }
  }, []);
    
  // Fetch time entries and employees when component mounts (only if user is present)
  useEffect(() => {
    if (userId) {
      loadData();
    } else {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [loadData, userId]);

  // If entries are already on screen, never keep the full-screen overlay.
  // This protects against rare cases where `loading` gets stuck true while data has arrived.
  useEffect(() => {
    const hasEntries = Array.isArray(timeEntries) && timeEntries.length > 0;
    if (loading && !initialLoadComplete && hasEntries) {
      setLoading(false);
      setInitialLoadComplete(true);
      if (import.meta?.env?.DEV) {
        console.log('[TimeClockEntry] cleared stuck overlay: entries present');
      }
    }
  }, [loading, initialLoadComplete, timeEntries]);

  // Use visibility refresh hook to reload data when page becomes visible after idle
  useAuthenticatedPageRefresh(() => loadData({ silent: true }));

  const applyStatusFilter = useCallback((entries) => {
    if (statusFilter === 'all') return entries;
    return entries.filter(
      (entry) => (entry.status || '').toLowerCase() === statusFilter
    );
  }, [statusFilter]);

  useEffect(() => {
    if (searchParams.get('review') !== 'pending') return;

    setReviewMode(true);
    setStatusFilter('pending');
    if (canManageTimeTracking) {
      setSelectedEmployeeFilter('all');
    }
    setSortKey('date');
    setSortDirection('desc');
    reviewScrollDoneRef.current = false;

    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete('review');
        return next;
      },
      { replace: true }
    );
  }, [searchParams, canManageTimeTracking, setSearchParams]);

  useEffect(() => {
    const entries = Array.isArray(timeEntries) ? timeEntries : [];
    let filtered;

    if (selectedEmployeeFilter === 'self') {
      const employeeId = userEmployeeId || userId;
      filtered = entries.filter(
        (entry) =>
          String(entry.employee_id) === String(employeeId) ||
          String(entry.employeeId) === String(employeeId)
      );
    } else if (selectedEmployeeFilter === 'all') {
      filtered = entries;
    } else {
      filtered = entries.filter(
        (entry) =>
          String(entry.employee_id) === String(selectedEmployeeFilter) ||
          String(entry.employeeId) === String(selectedEmployeeFilter)
      );
    }

    setFilteredEntries(applyStatusFilter(filtered));
  }, [selectedEmployeeFilter, timeEntries, userId, userEmployeeId, applyStatusFilter]);

  useEffect(() => {
    // Deep-link review mode: scroll history into view once when data is ready.
    // Do not depend on filteredEntries — that re-fired on unrelated UI updates.
    if (!reviewMode || reviewScrollDoneRef.current || !initialLoadComplete || loading) {
      return;
    }

    reviewScrollDoneRef.current = true;
    const timer = setTimeout(() => {
      historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);

    return () => clearTimeout(timer);
  }, [reviewMode, initialLoadComplete, loading]);

  const validateForm = () => {
    const newErrors = {};
    const isOnLeave = formData.hourType === 'on_leave';

    if (!formData.date) {
      newErrors.date = t('timeClock.errors.dateRequired');
    }

    if (!isOnLeave) {
      if (!formData.clockIn) {
        newErrors.clockIn = t('timeClock.errors.clockInRequired');
      }

      if (!formData.clockOut) {
        newErrors.clockOut = t('timeClock.errors.clockOutRequired');
      }

      if (formData.clockIn && formData.clockOut) {
        const hoursDiff = getHoursWorked(formData.date, formData.clockIn, formData.clockOut);
        
        if (hoursDiff <= 0) {
          newErrors.clockOut = t('timeClock.errors.clockOutAfterClockIn');
        }

        if (hoursDiff > 24) {
          newErrors.clockOut = t('timeClock.errors.tooManyHours');
        }
      }

      // Check for overlapping shifts on the same day (only when times provided)
      const overlapping = timeEntries.some(entry => {
        if (entry.date !== formData.date) return false;
        if (!entry.clockIn || !entry.clockOut) return false;
        if (!formData.clockIn || !formData.clockOut) return false;

        const timeStringToSeconds = (value) => {
          const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (!match) return null;
          return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
        };

        const newClockInSeconds = timeStringToSeconds(formData.clockIn);
        const newClockOutSeconds = timeStringToSeconds(formData.clockOut);
        const existingClockInSeconds = timeStringToSeconds(entry.clockIn);
        const existingClockOutSeconds = timeStringToSeconds(entry.clockOut);
        if (
          newClockInSeconds == null ||
          newClockOutSeconds == null ||
          existingClockInSeconds == null ||
          existingClockOutSeconds == null
        ) {
          return false;
        }

        return extendedIntervalsOverlap(
          toExtendedInterval(newClockInSeconds, newClockOutSeconds),
          toExtendedInterval(existingClockInSeconds, existingClockOutSeconds)
        );
      });

      if (overlapping) {
        newErrors.general = t('timeClock.errors.overlapping');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  
  // Calculate hours worked
  const calculateHours = (clockIn, clockOut, date) => {
    return getHoursWorked(date, clockIn, clockOut).toFixed(1);
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, proofFile: t('timeClock.errors.fileTooLarge') });
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setErrors({ ...errors, proofFile: t('timeClock.errors.invalidFileType') });
        return;
      }

      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, proofFile: { name: file.name, type: file.type, data: reader.result } });
        setErrors({ ...errors, proofFile: null });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const isOnLeave = formData.hourType === 'on_leave';
      const hours = isOnLeave ? 0 : calculateHours(formData.clockIn, formData.clockOut, formData.date);
      // Some DB schemas require non-null clock fields; use subtle placeholders for leave
      const LEAVE_CLOCK_IN = '09:00';
      const LEAVE_CLOCK_OUT = '09:01';
      
      // Upload proof file if exists
      let proofFileUrl = null;
      let proofFileName = null;
      let proofFileType = null;
      let proofFilePath = null;
      
      if (formData.proofFile) {
        // Convert base64 back to file for upload (as a complete single file)
        const base64Data = formData.proofFile.data;
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        // Create File object with complete byte array (ensures single-part upload)
        const file = new File([byteArray], formData.proofFile.name, { 
          type: formData.proofFile.type,
          lastModified: Date.now()
        });
        
        const uploadResult = await timeTrackingService.uploadProofFile(file, user?.id);
        if (uploadResult.success) {
          proofFileUrl = uploadResult.url;
          proofFileName = uploadResult.fileName;
          proofFileType = uploadResult.fileType;
          proofFilePath = uploadResult.storagePath;
        }
      }
      
      // Ensure employee exists in database before creating time entry
      const employeeCheck = await timeTrackingService.ensureEmployeeExists(user?.id, {
        name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'User',
        email: user?.email,
        position: user?.user_metadata?.position,
        department: user?.user_metadata?.department
      });

      if (!employeeCheck.success) {
        setErrors({ general: employeeCheck.error || 'Employee record not found. Please contact HR.' });
        setIsSubmitting(false);
        return;
      }

      if (employeeCheck.created) {
        console.log('Employee record created automatically for user:', user?.id);
      }
      
      // Create time entry in Supabase
      // Use employeeId from user profile to link with employees table
      const employeeId = user?.employeeId || user?.id;
      
      // Check for overlapping time entries on this date with the same hour type
      let existingEntries = [];
      let checkError = null;

      if (isDemoMode()) {
        existingEntries = [];
      } else {
        const { data, error } = await supabase
          .from('time_entries')
          .select('id, hour_type, clock_in, clock_out')
          .eq('employee_id', employeeId)
          .eq('date', formData.date)
          .eq('hour_type', formData.hourType);
        existingEntries = data;
        checkError = error;
      }
      
      if (checkError) {
        console.error('Error checking existing entries:', checkError);
        setErrors({ general: t('timeClock.errors.submitFailed') });
        setIsSubmitting(false);
        return;
      }
      
      // Check for overlaps or duplicates
      if (existingEntries && existingEntries.length > 0) {
        if (isOnLeave) {
          // Prevent duplicate on-leave entries for the same day/hour type
          const hourTypeLabel = t(`timeClock.hourTypes.${formData.hourType}`, formData.hourType);
          const errorMsg = t('timeClock.errors.overlappingEntry', 'This {hourType} time entry overlaps with an existing entry ({existingIn} - {existingOut})')
            .replace('{hourType}', hourTypeLabel)
            .replace('{existingIn}', existingEntries[0].clock_in || 'N/A')
            .replace('{existingOut}', existingEntries[0].clock_out || 'N/A');
          setErrors({ general: errorMsg });
          setIsSubmitting(false);
          return;
        }

        const newClockIn = formData.clockIn;
        const newClockOut = formData.clockOut;
        
        for (const entry of existingEntries) {
          const existingClockIn = entry.clock_in;
          const existingClockOut = entry.clock_out;
          
          // Check if times overlap
          const isOverlapping = (
            (newClockIn >= existingClockIn && newClockIn < existingClockOut) ||
            (newClockOut > existingClockIn && newClockOut <= existingClockOut) ||
            (newClockIn <= existingClockIn && newClockOut >= existingClockOut)
          );
          
          if (isOverlapping) {
            const hourTypeLabel = t(`timeClock.hourTypes.${formData.hourType}`, formData.hourType);
            const errorMsg = t('timeClock.errors.overlappingEntry', 'This {hourType} time entry overlaps with an existing entry ({existingIn} - {existingOut})').replace('{hourType}', hourTypeLabel).replace('{existingIn}', existingClockIn).replace('{existingOut}', existingClockOut);
            console.log('Overlapping entry error:', errorMsg);
            setErrors({ general: errorMsg });
            setIsSubmitting(false);
            return;
          }
        }
      }
      
      const result = await timeTrackingService.createTimeEntry({
        employeeId: employeeId,
        date: formData.date,
        clockIn: isOnLeave ? LEAVE_CLOCK_IN : formData.clockIn,
        clockOut: isOnLeave ? LEAVE_CLOCK_OUT : formData.clockOut,
        hours: parseFloat(hours),
        hourType: formData.hourType,
        notes: formData.notes,
        proofFileUrl,
        proofFileName,
        proofFileType,
        proofFilePath
      });
      
      if (result.success) {
        // Refresh time entries using the centralized fetch function
        await fetchTimeEntries();
        
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          clockIn: '',
          clockOut: '',
          hourType: 'regular',
          notes: '',
          proofFile: null
        });

        setSuccessMessage(t('timeClock.success'));
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: result.error || t('timeClock.errors.submitFailed') });
      }
    } catch (error) {
      console.error('Error submitting time entry:', error);
      if (handleSessionAuthError(error)) return;
      setErrors({ general: t('timeClock.errors.submitFailed') });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to check if file is an image
  const isImageFile = (fileType, fileUrl) => {
    // First check MIME type
    if (fileType && fileType.startsWith('image/')) {
      return true;
    }

    // Check data URL mime type
    if (fileUrl && fileUrl.startsWith('data:image/')) {
      return true;
    }
    
    // Fallback: check file extension from URL
    if (fileUrl) {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      const urlLower = fileUrl.toLowerCase();
      return imageExtensions.some(ext => urlLower.includes(ext));
    }
    
    return false;
  };

  // Delete entry or proof file
  const handleDelete = async (id, entry) => {
    // Check if entry has a proof file
    const hasProof = entry?.proof_file_url;
    
    let deleteChoice;
    if (hasProof) {
      // Show custom confirmation with two options
      const message = `${t('timeClock.deleteOptions', 'Choose delete option')}:\n\n1 - ${t('timeClock.deleteEntry', 'Delete entire time entry')}\n2 - ${t('timeClock.deleteProofOnly', 'Delete proof file only')}\n\n${t('timeClock.enterChoice', 'Enter 1 or 2')}:`;
      deleteChoice = window.prompt(message);
      
      if (!deleteChoice) return; // User cancelled
      
      deleteChoice = deleteChoice.trim();
      
      if (deleteChoice !== '1' && deleteChoice !== '2') {
        alert(t('timeClock.invalidChoice', 'Invalid choice. Please enter 1 or 2.'));
        return;
      }
    } else {
      // No proof file, just confirm deletion of entry
      if (!window.confirm(t('timeClock.confirmDelete'))) {
        return;
      }
      deleteChoice = '1';
    }
    
    try {
      if (deleteChoice === '2') {
        // Delete only the proof file
        const result = await timeTrackingService.deleteProofFile(id, entry.proof_file_path);
        
        if (result.success) {
          // Refresh time entries using the centralized fetch function
          await fetchTimeEntries();
          
          setUploadToast({
            show: true,
            message: t('timeClock.proofDeleteSuccess', 'Proof file deleted successfully'),
            type: 'success'
          });
          setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 3000);
        } else {
          setUploadToast({
            show: true,
            message: result.error || t('timeClock.proofDeleteError', 'Failed to delete proof file'),
            type: 'error'
          });
          setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
        }
      } else {
        // Delete entire entry
        const result = await timeTrackingService.deleteTimeEntry(id);
        if (result.success) {
          // Refresh time entries using the centralized fetch function
          await fetchTimeEntries();
          setSuccessMessage(t('timeClock.deleteSuccess', 'Time entry deleted successfully'));
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setErrors({ general: t('timeClock.errors.deleteFailed') });
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      if (handleSessionAuthError(error)) return;
      setErrors({ general: t('timeClock.errors.deleteFailed') });
    }
  };

  // Handle uploading proof to existing time entry
  const handleUploadProof = async (entryId, file) => {
    if (!file) return;

    setUploadingProofId(entryId);
    setUploadProgress({ [file.name]: 0 });
    
    try {
      const result = await timeTrackingService.updateTimeEntryProof(
        entryId, 
        file, 
        user?.id,
        (percent) => {
          // Update progress
          setUploadProgress({ [file.name]: percent });
        }
      );
      
      if (result.success) {
        // Clear progress after completion
        setTimeout(() => {
          setUploadProgress({});
        }, 2000);
        
        // Refresh time entries using the centralized fetch function
        await fetchTimeEntries();

        // Show success toast
        setUploadToast({
          show: true,
          message: t('timeClock.proofUploadSuccess', 'Proof file uploaded successfully'),
          type: 'success'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 3000);
      } else {
        // Clear progress on error
        setUploadProgress({});
        
        // Show error toast
        setUploadToast({
          show: true,
          message: result.error || t('timeClock.proofUploadError', 'Failed to upload proof file'),
          type: 'error'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
      }
    } catch (error) {
      console.error('Error uploading proof:', error);
      if (handleSessionAuthError(error)) return;
      setUploadToast({
        show: true,
        message: t('timeClock.proofUploadError', 'Failed to upload proof file'),
        type: 'error'
      });
      setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
    } finally {
      setUploadingProofId(null);
    }
  };
  
  // Check if user can approve based on role and entry owner
  const canApprove = (entry) => {
    // In demo mode, always allow approval for demo purposes
    if (isDemoMode()) return true;
    
    if (!user || !user.role) return false;
    
    // Get entry owner's role (assume from entry data or default to employee)
    const entryOwnerRole = entry.employee_role || 'employee';
    
    // Admin / demo admin can approve anyone
    if (user.role === 'admin' || user.role === 'demo_admin') return true;
    
    // Manager can approve employees only
    if (user.role === 'manager' && entryOwnerRole === 'employee') return true;
    
    // Employee cannot approve
    return false;
  };
  
  // Handle approval of time entry
  const handleApprove = async (entryId) => {
    setApprovingEntryId(entryId);
    
    try {
      const approverId = user?.employee_id || user?.id;
      const result = await timeTrackingService.updateTimeEntryStatus(entryId, 'approved', approverId);
      
      if (result.success) {
        // Refresh time entries using the centralized fetch function
        await fetchTimeEntries();
        if (typeof checkPendingApprovals === 'function') {
          await checkPendingApprovals();
        }

        setUploadToast({
          show: true,
          message: t('timeClock.approvalSuccess', 'Time entry approved successfully'),
          type: 'success'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 3000);
      } else {
        setUploadToast({
          show: true,
          message: result.error || t('timeClock.approvalError', 'Failed to approve entry'),
          type: 'error'
        });
        setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
      }
    } catch (error) {
      console.error('Error approving entry:', error);
      if (handleSessionAuthError(error)) return;
      setUploadToast({
        show: true,
        message: t('timeClock.approvalError', 'Failed to approve entry'),
        type: 'error'
      });
      setTimeout(() => setUploadToast({ show: false, message: '', type: '' }), 5000);
    } finally {
      setApprovingEntryId(null);
    }
  };

  // Calculate totals (including pending and approved time entries)
  const calculateTotals = (filterType = 'all', period = 'week') => {
    if (!Array.isArray(timeEntries)) return 0;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count pending and approved entries
    return timeEntries.reduce((acc, entry) => {
      const entryDate = new Date(entry.date);
      
      // Filter by period
      if (period === 'week' && entryDate < startOfWeek) return acc;
      if (period === 'month' && entryDate < startOfMonth) return acc;

      // Include pending and approved entries (not rejected)
      if (entry.status === 'rejected') return acc;

      // Filter by type (using hour_type from Supabase)
      const entryType = entry.hour_type || entry.hourType;
      if (filterType === 'all' || entryType === filterType) {
        acc += parseFloat(entry.hours || 0);
      }

      return acc;
    }, 0);
  };
  
  // Calculate leave days (including pending and approved)
  const calculateLeaveDays = (period = 'week') => {
    if (!Array.isArray(leaveRequests)) return 0;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return leaveRequests.reduce((acc, req) => {
      const startDate = new Date(req.start_date);
      
      // Filter by period
      if (period === 'week' && startDate < startOfWeek) return acc;
      if (period === 'month' && startDate < startOfMonth) return acc;

      // Include pending and approved (not rejected)
      if (req.status === 'rejected') return acc;

      acc += parseFloat(req.days_count || 0);
      return acc;
    }, 0);
  };

  // Chip order, not database order: the type you pick nine times out of ten sits
  // first, then the two the system can usually infer, then the exceptions.
  const hourTypes = [
    { value: 'regular', label: t('timeClock.hourTypes.regular') },
    { value: 'weekend', label: t('timeClock.hourTypes.weekend') },
    { value: 'holiday', label: t('timeClock.hourTypes.holiday') },
    { value: 'overtime', label: t('timeClock.hourTypes.overtime') },
    { value: 'bonus', label: t('timeClock.hourTypes.bonus') },
    { value: 'wfh', label: t('timeClock.hourTypes.wfh') },
    { value: 'on_leave', label: t('timeClock.hourTypes.onLeave', 'On Leave'), t: 'timeClock.hourTypes.onLeave' },
  ];

  const onLeaveForSelectedDate = useMemo(() => {
    if (!Array.isArray(leaveRequests) || !formData.date) return [];
    const target = new Date(formData.date);

    return leaveRequests
      .filter((req) => {
        if (!req?.start_date || !req?.end_date) return false;
        const status = (req.status || '').toLowerCase();
        if (['rejected', 'cancelled'].includes(status)) return false;

        const start = new Date(req.start_date);
        const end = new Date(req.end_date);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

        return start <= target && end >= target;
      })
      .map((req) => {
        const fallbackName = Array.isArray(allEmployees)
          ? allEmployees.find((e) => String(e.id) === String(req.employee_id))?.name
          : null;
          const displayName = req.employee?.name || req.employee_name || fallbackName || t('timeClock.unknownEmployee', 'Unknown');
        return { ...req, displayName };
      });
        }, [leaveRequests, formData.date, allEmployees, t, userEmployeeId, userId]);

  // Sorting function for history table (includes leave rows for selected date)
  const getSortedEntries = useMemo(() => {
    const leaveRows = onLeaveForSelectedDate
      .filter((leave) => {
        if (selectedEmployeeFilter === 'self') {
          const employeeId = userEmployeeId || userId;
          return String(leave.employee_id) === String(employeeId);
        }
        if (selectedEmployeeFilter === 'all') return true;
        return String(leave.employee_id) === String(selectedEmployeeFilter);
      })
      .filter((leave) => {
        if (statusFilter === 'all') return true;
        return (leave.status || '').toLowerCase() === statusFilter;
      })
      .map((leave) => ({
        id: `leave-${leave.id}-${formData.date}`,
        date: formData.date,
        hours: 0,
        hour_type: 'on_leave',
        status: leave.status || 'approved',
        employee_name: leave.displayName,
        employee_id: leave.employee_id,
        employee: leave.employee || null,
        clock_in: null,
        clock_out: null,
        notes: leave.reason || '',
        proof_file_url: null,
        proof_file_type: null,
        created_at: leave.created_at || leave.submitted_at || leave.start_date || formData.date
      }));

    const combined = [...filteredEntries, ...leaveRows];

    const sorted = [...combined];
    sorted.sort((a, b) => {
      let aValue, bValue;
      switch (sortKey) {
        case 'date':
          aValue = new Date(a.date || a.created_at).getTime();
          bValue = new Date(b.date || b.created_at).getTime();
          break;
        case 'employee':
          aValue = (a.employee_name || a.employee?.name || '').toLowerCase();
          bValue = (b.employee_name || b.employee?.name || '').toLowerCase();
          break;
        case 'hours':
          aValue = a.hours || 0;
          bValue = b.hours || 0;
          break;
        case 'type':
          aValue = (a.hour_type || a.hourType || '').toLowerCase();
          bValue = (b.hour_type || b.hourType || '').toLowerCase();
          break;
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
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
  }, [filteredEntries, onLeaveForSelectedDate, selectedEmployeeFilter, statusFilter, user, sortKey, sortDirection, formData.date]);

  // Eight columns do not fit a phone, so Time and Type drop out and reappear as
  // stacked detail under the date. While a row is being edited they are forced
  // back: those two cells hold the inline time pickers and hour-type select, and
  // hiding them would make an entry uneditable on a small screen.
  const colTimeClass = editingEntryId ? COL.always : COL.lg;
  const colTypeClass = editingEntryId ? COL.always : COL.md;

  // Helper function to translate status
  const translateStatus = (status) => {
    if (!status) return '';
    const statusKey = `status.${status.toLowerCase()}`;
    return t(statusKey, status.charAt(0).toUpperCase() + status.slice(1));
  };

  // Format time string to HH:MM format
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    // If it's already in HH:MM:SS format, extract HH:MM
    if (timeStr.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
      return timeStr.substring(0, 5);
    }
    // If it contains a T (ISO format like 2025-12-04T09:00:00), extract time part
    if (timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1];
      if (timePart) {
        return timePart.substring(0, 5);
      }
    }
    // Try to parse as date and extract time
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    } catch {
      // Fall through
    }
    return timeStr;
  };

  const isLeaveHistoryRow = (entry) => String(entry?.id || '').startsWith('leave-');

  const canEditEntry = (entry) => {
    if (!entry || isLeaveHistoryRow(entry)) return false;
    if (canManageTimeTracking) return true;
    const ownerId = entry.employee_id || entry.employeeId || entry.employee?.id;
    return String(ownerId) === String(userEmployeeId || userId);
  };

  const timeToMinutes = (timeStr) => {
    const normalized = formatTime(timeStr);
    if (!normalized || !normalized.includes(':')) return null;
    const [h, m] = normalized.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const minutesToTime = (totalMinutes) => {
    const dayMins = 24 * 60;
    let mins = ((totalMinutes % dayMins) + dayMins) % dayMins;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const startEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditForm({
      date: entry.date || '',
      clockIn: formatTime(entry.clock_in || entry.clockIn),
      clockOut: formatTime(entry.clock_out || entry.clockOut),
      hours: String(entry.hours ?? 0),
      hourType: entry.hour_type || entry.hourType || 'regular',
    });
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditForm({ date: '', clockIn: '', clockOut: '', hours: '', hourType: 'regular' });
  };

  const handleEditTimeChange = (field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (next.hourType === 'on_leave') {
        next.hours = '0';
        return next;
      }
      if (next.clockIn && next.clockOut) {
        const hoursValue = Number(calculateHours(next.clockIn, next.clockOut, next.date || formData.date));
        next.hours = Number.isFinite(hoursValue) ? hoursValue.toFixed(2) : prev.hours;
      }
      return next;
    });
  };

  const handleEditHoursChange = (value) => {
    setEditForm((prev) => {
      if (prev.hourType === 'on_leave') {
        return { ...prev, hours: '0' };
      }
      const hoursNum = Math.max(0, Number(value) || 0);
      const start = timeToMinutes(prev.clockIn) ?? timeToMinutes('09:00');
      return {
        ...prev,
        hours: value,
        clockIn: prev.clockIn || '09:00',
        clockOut: minutesToTime(start + Math.round(hoursNum * 60)),
      };
    });
  };

  const handleEditTypeChange = (value) => {
    setEditForm((prev) => {
      if (value === 'on_leave') {
        return { ...prev, hourType: value, hours: '0', clockIn: '', clockOut: '' };
      }
      const next = { ...prev, hourType: value };
      if (next.clockIn && next.clockOut) {
        const hoursValue = Number(calculateHours(next.clockIn, next.clockOut, next.date || formData.date));
        next.hours = Number.isFinite(hoursValue) ? hoursValue.toFixed(2) : prev.hours;
      }
      return next;
    });
  };

  const applyEntryUpdateLocally = (entryId, updates) => {
    const patch = (list) =>
      (list || []).map((item) =>
        String(item.id) === String(entryId)
          ? {
              ...item,
              ...updates,
              clock_in: updates.clock_in ?? item.clock_in,
              clock_out: updates.clock_out ?? item.clock_out,
              hour_type: updates.hour_type ?? item.hour_type,
            }
          : item
      );
    setTimeEntries((prev) => patch(prev));
    setFilteredEntries((prev) => patch(prev));
  };

  const saveEditEntry = async () => {
    if (!editingEntryId) return;
    const hoursNum = Number(editForm.hours);

    if (!editForm.date) {
      setErrors({ general: t('timeClock.errors.dateRequired', 'Date is required') });
      return;
    }
    if (editForm.hourType !== 'on_leave') {
      if (!editForm.clockIn || !editForm.clockOut) {
        setErrors({ general: t('timeClock.errors.timeRequired', 'Clock in and clock out are required') });
        return;
      }
      if (!Number.isFinite(hoursNum) || hoursNum < 0) {
        setErrors({ general: t('timeClock.errors.invalidHours', 'Hours must be a valid number') });
        return;
      }
    }

    setSavingEntryId(editingEntryId);
    try {
      const result = await timeTrackingService.updateTimeEntry(editingEntryId, {
        date: editForm.date,
        clockIn: editForm.hourType === 'on_leave' ? null : editForm.clockIn,
        clockOut: editForm.hourType === 'on_leave' ? null : editForm.clockOut,
        hours: editForm.hourType === 'on_leave' ? 0 : hoursNum,
        hourType: editForm.hourType,
      });
      if (!result.success) {
        setErrors({ general: result.error || t('timeClock.errors.updateFailed', 'Failed to update entry') });
        return;
      }

      applyEntryUpdateLocally(editingEntryId, {
        date: editForm.date,
        clock_in: editForm.hourType === 'on_leave' ? null : editForm.clockIn,
        clock_out: editForm.hourType === 'on_leave' ? null : editForm.clockOut,
        hours: editForm.hourType === 'on_leave' ? 0 : hoursNum,
        hour_type: editForm.hourType,
      });
      setSuccessMessage(t('timeClock.updateSuccess', 'Time entry updated successfully'));
      setTimeout(() => setSuccessMessage(''), 3000);
      cancelEditEntry();
    } catch (error) {
      if (handleSessionAuthError(error)) return;
      setErrors({ general: error.message || t('timeClock.errors.updateFailed', 'Failed to update entry') });
    } finally {
      setSavingEntryId(null);
    }
  };

  /**
   * Status reads through weight and rule, never through red/green:
   * approved is settled and recedes to neutral, pending is the one that wants
   * you, rejected is outlined so it stays legible without shouting.
   */
  const statusVariant = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'approved': return 'neutral';
      case 'rejected': return 'outline';
      default: return 'accent';
    }
  };

  /* ---------------------------------------------------------------- *
   * Derived figures — everything the ticker and the right rail read
   * ---------------------------------------------------------------- */

  const fmtDay = useCallback(
    (value) => formatDate(value, currentLanguage, { day: '2-digit', month: 'short' }),
    [currentLanguage]
  );

  /** Sunday-start, to match the window calculateTotals() already counts against. */
  const weekWindow = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }, []);

  const weekRangeLabel = `${fmtDay(weekWindow.start)} – ${fmtDay(weekWindow.end)}`;
  const monthLabel = formatDate(new Date(), currentLanguage, { month: 'long', year: 'numeric' });

  /** One row per hour type, in chip order, for whichever period the rail asks for. */
  const breakdownFor = (period) => hourTypes.map((type) => ({
    ...type,
    hours: calculateTotals(type.value, period),
  }));

  const weekBreakdown = breakdownFor('week');
  const monthBreakdown = breakdownFor('month');
  const weekTotal = calculateTotals('all', 'week');
  const monthTotal = calculateTotals('all', 'month');
  const weekPeak = Math.max(...weekBreakdown.map((row) => row.hours), 0);
  const monthTop = [...monthBreakdown].sort((a, b) => b.hours - a.hours)[0];
  const monthRest = monthBreakdown.filter((row) => row !== monthTop);
  const leaveWeek = calculateLeaveDays('week');
  const leaveMonth = calculateLeaveDays('month');

  /** Hours this form will file if you submit it as it stands. */
  const formHours = useMemo(() => {
    if (formData.hourType === 'on_leave') return 0;
    if (!formData.clockIn || !formData.clockOut) return 0;
    const value = getHoursWorked(formData.date, formData.clockIn, formData.clockOut);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [formData.date, formData.clockIn, formData.clockOut, formData.hourType]);

  const weekProjected = weekTotal + formHours;
  const weekRemaining = Math.max(0, CONTRACT_WEEK_HOURS - weekProjected);

  const boardStats = useMemo(() => {
    const list = Array.isArray(timeEntries) ? timeEntries : [];
    const pending = list.filter((e) => (e.status || '').toLowerCase() === 'pending');
    return {
      pending: pending.length,
      // Only pending rows count: an approved entry no longer needs its paperwork.
      missingProof: pending.filter((e) => !e.proof_file_url && !e.proofFile).length,
    };
  }, [timeEntries]);

  const hasRealData = initialLoadComplete && Array.isArray(timeEntries) && timeEntries.length > 0;

  const meName = user?.name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || t('timeClock.myEntries', 'My Entries');

  /**
   * The scope switch. Bulk is a different screen (AdminTimeEntry), the other two
   * are the same screen pointed at a different set of rows — so the seg reads its
   * value back off the employee filter instead of keeping a second copy of it.
   */
  const [bulkOpen, setBulkOpen] = useState(false);
  const segValue = bulkOpen ? 'bulk' : (selectedEmployeeFilter === 'self' ? 'self' : 'admin');
  const handleSegChange = (value) => {
    if (value === 'bulk') {
      setBulkOpen(true);
      return;
    }
    setBulkOpen(false);
    setSelectedEmployeeFilter(value === 'self' ? 'self' : 'all');
  };

  const entryDateLabel = formData.date
    ? formatDate(formData.date, currentLanguage, {
      day: '2-digit', month: 'short', year: 'numeric', weekday: 'long',
    })
    : '—';

  const headSub = [
    t('timeClock.subtitle'),
    meName,
    entryDateLabel,
  ].filter(Boolean).join(' · ');

  const captionStyle = {
    fontFamily: BODY,
    fontSize: 11.5,
    color: ind.inkFaint,
    margin: '6px 0 0',
    lineHeight: 1.5,
  };

  const fieldLabelStyle = {
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    color: ind.inkMuted,
    display: 'block',
    marginBottom: 4,
  };

  const thStyle = {
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: ind.inkMuted,
    padding: '0 10px 8px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const tdStyle = {
    fontFamily: BODY,
    fontSize: 13,
    color: ind.ink,
    padding: '9px 10px',
    borderTop: `1px solid ${ind.rule}`,
    verticalAlign: 'middle',
  };

  /** The 22px bordered squares that carry the per-row actions. */
  const iconBtnStyle = {
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${ind.hairline}`,
    background: 'transparent',
    color: ind.ink,
    borderRadius: 0,
    cursor: 'pointer',
    padding: 0,
    flex: 'none',
  };

  const editInputClass = 'w-full min-w-[7rem] px-2 py-1 text-sm';
  const editInputStyle = {
    border: `1px solid ${ind.hairline}`,
    background: 'transparent',
    color: ind.ink,
    borderRadius: 0,
    fontFamily: BODY,
  };

  /** Validation reads through weight, not colour — the system has no red. */
  const errorTextStyle = {
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: ind.ink,
    margin: '4px 0 0',
  };

  /** The employee column is dead weight when the ledger only holds your rows. */
  const showEmployeeColumn = selectedEmployeeFilter !== 'self';

  /** First and last date actually on screen, for the ledger foot. */
  const ledgerRangeLabel = useMemo(() => {
    const stamps = getSortedEntries
      .map((entry) => new Date(entry.date || entry.created_at).getTime())
      .filter((n) => Number.isFinite(n));
    if (stamps.length === 0) return '';
    const from = fmtDay(new Date(Math.min(...stamps)));
    const to = fmtDay(new Date(Math.max(...stamps)));
    return from === to ? from : `${from} – ${to}`;
  }, [getSortedEntries, fmtDay]);

  return (
    <div
      key={currentLanguage}
      data-screen-label="Chấm công"
      style={{
        border: `1px solid ${ind.hairline}`,
        background: ind.ground,
        color: ind.ink,
        fontFamily: BODY,
        fontSize: 14,
        borderRadius: 0,
      }}
    >
      {/* ── TICKER — spans both bands, so it is their sibling ───────── */}
      <div
        style={{
          height: 44, background: ind.tickerBg, color: ind.tickerInk,
          borderBottom: `1px solid ${ind.hairline}`,
          display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
        }}
      >
        <TickerCell ind={ind}>
          <LiveClock ind={ind} live={hasRealData} />
        </TickerCell>
        <TickerCell ind={ind} label={t('timeClock.thisWeek', 'This Week')} value={`${weekTotal.toFixed(1)}h`} />
        <TickerCell ind={ind} label={t('timeClock.thisMonth', 'This Month')} value={`${monthTotal.toFixed(1)}h`} />
        <TickerCell
          ind={ind}
          label={t('timeClock.awaitingApproval', 'Awaiting approval')}
          value={boardStats.pending}
          // The one figure on the strip that asks somebody to decide.
          valueColor={boardStats.pending > 0 ? ind.tickerUp : undefined}
        />
        <TickerCell ind={ind} label={t('timeClock.missingProof', 'Missing proof')} value={boardStats.missingProof} />
        <TickerCell
          ind={ind}
          label={t('timeClock.leaveDays', 'Leave Days')}
          value={`${leaveWeek.toFixed(1)}${t('timeClock.dayShort', 'd')}`}
        />

        <div
          style={{
            flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 8, padding: '0 14px',
            borderLeft: `1px solid ${ind.tickerRule}`,
          }}
        >
          <FetchElapsedPill active={loading} isDarkMode label={t('common.fetching', 'Fetching')} />
          {canManageTimeTracking ? (
            <FlatSelect
              ind={ind}
              onDark
              value={selectedEmployeeFilter}
              onChange={(e) => {
                setSelectedEmployeeFilter(e.target.value);
                setBulkOpen(false);
                setTimeout(() => fetchTimeEntries(), 100);
              }}
              aria-label={t('timeClock.viewEntries', 'View Entries')}
              style={{ maxWidth: 220 }}
            >
              <option value="self" style={{ color: '#1d1f20' }}>{t('timeClock.myEntries', 'My Entries')}</option>
              <option value="all" style={{ color: '#1d1f20' }}>{t('timeClock.allEmployees', 'All Employees')}</option>
              {Array.isArray(allEmployees) && allEmployees.length > 0 && (
                <optgroup label={t('timeClock.specificEmployee', 'Specific Employee')}>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} style={{ color: '#1d1f20' }}>
                      {getDemoEmployeeName(emp, t)}
                    </option>
                  ))}
                </optgroup>
              )}
            </FlatSelect>
          ) : (
            <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {meName}
            </span>
          )}
        </div>
      </div>

      {/* ── BANDS ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — min-w-0 or the eight-column table wins ───────── */}
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

          {(errors.general || fetchError) && (
            <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>
                  {errors.general || fetchError}
                </p>
                {fetchError && (
                  <button
                    type="button"
                    onClick={() => { setFetchError(null); loadData(); }}
                    style={{
                      marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                      textTransform: 'uppercase', color: ind.accentDeep, textDecoration: 'underline',
                    }}
                  >
                    {t('common.retry', 'Try Again')}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setErrors({ ...errors, general: null }); setFetchError(null); }}
                aria-label={t('common.close', 'Close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* ── PAGE HEAD ──────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('timeClock.title')}
              </h1>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 6 }}>
                {headSub}
              </p>
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
              {canManageTimeTracking && (
                <Seg
                  ind={ind}
                  ariaLabel={t('timeClock.viewEntries', 'View Entries')}
                  value={segValue}
                  onChange={handleSegChange}
                  options={[
                    { value: 'self', label: t('timeClock.scopeMine', 'Mine') },
                    { value: 'admin', label: t('timeClock.scopeAdmin', 'Admin') },
                    { value: 'bulk', label: t('timeClock.scopeBulk', 'Bulk') },
                  ]}
                />
              )}
              <Btn
                ind={ind}
                onClick={() => setShowLeaveModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Calendar size={13} strokeWidth={1.5} />
                {t('timeClock.requestLeave', 'Request Leave')}
              </Btn>
            </div>
          </div>

          {bulkOpen ? (
            /* Bulk entry and the standard-hours fill live in one place, so this
               screen hands the whole band over rather than keeping a second copy
               of the same form. */
            <AdminTimeEntry onEntriesChanged={fetchTimeEntries} />
          ) : (
            <>
              {/* ── ENTRY FORM ─────────────────────────────────────── */}
              <form onSubmit={handleSubmit} style={{ flex: 'none' }}>
                <Blueprint ind={ind} style={{ padding: '18px 20px 16px' }}>
                  <div className="flex flex-col lg:flex-row" style={{ gap: 28 }}>

                    {/* Collect */}
                    <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 14 }}>
                      <div>
                        <ColumnHeading ind={ind}>{t('timeClock.newEntry')}</ColumnHeading>
                        <p style={captionStyle}>
                          {t('timeClock.entryHint', 'Hours are filed for approval. Attach proof now, or from the ledger below.')}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="date-input" style={fieldLabelStyle}>{t('timeClock.date', 'Date')}</label>
                          <DatePicker
                            flat
                            id="date-input"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            max={new Date().toISOString().split('T')[0]}
                          />
                          {errors.date && <p style={errorTextStyle}>{errors.date}</p>}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="clock-in-input" style={fieldLabelStyle}>{t('timeClock.clockIn')}</label>
                          <TimePicker
                            flat
                            id="clock-in-input"
                            value={formData.clockIn}
                            disabled={formData.hourType === 'on_leave'}
                            onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                          />
                          {errors.clockIn && <p style={errorTextStyle}>{errors.clockIn}</p>}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="clock-out-input" style={fieldLabelStyle}>{t('timeClock.clockOut')}</label>
                          <TimePicker
                            flat
                            id="clock-out-input"
                            value={formData.clockOut}
                            disabled={formData.hourType === 'on_leave'}
                            onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                          />
                          {errors.clockOut && <p style={errorTextStyle}>{errors.clockOut}</p>}
                        </div>
                      </div>

                      {/* Hour type — chips, because the list is short and the
                          choice changes what the figure on the right says. */}
                      <div>
                        <span style={fieldLabelStyle}>{t('timeClock.hourType')}</span>
                        <div className="flex flex-wrap" style={{ gap: 6 }}>
                          {hourTypes.map((type) => {
                            const active = formData.hourType === type.value;
                            return (
                              <button
                                key={type.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setFormData({ ...formData, hourType: type.value })}
                                style={{
                                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5,
                                  letterSpacing: '.08em', textTransform: 'uppercase',
                                  padding: '5px 10px', borderRadius: 0, cursor: 'pointer', whiteSpace: 'nowrap',
                                  background: active ? ind.accent : 'transparent',
                                  color: active ? ind.accentInk : ind.inkGhost,
                                  border: `1px solid ${active ? ind.accent : ind.hairline}`,
                                  transition: 'background .15s ease, color .15s ease',
                                }}
                              >
                                {type.label}
                              </button>
                            );
                          })}
                        </div>
                        <p style={captionStyle}>
                          {t('timeClock.autoDetectNote', 'Weekend and holiday follow from the date — change the type only when the day is an exception.')}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="notes-textarea" style={fieldLabelStyle}>
                            {`${t('timeClock.notes')} · ${t('timeClock.optional')}`}
                          </label>
                          <textarea
                            id="notes-textarea"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder={t('timeClock.notesPlaceholder')}
                            style={{
                              width: '100%', height: 62, padding: '7px 10px', resize: 'vertical',
                              border: `1px solid ${ind.hairline}`, borderRadius: 0,
                              background: 'transparent', color: ind.ink,
                              fontFamily: BODY, fontSize: 12.5,
                            }}
                          />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <span style={fieldLabelStyle}>{t('timeClock.proof')}</span>
                          <label
                            htmlFor="proof-file-upload"
                            className="flex items-center"
                            style={{
                              height: 62, gap: 10, padding: '0 12px', cursor: 'pointer',
                              border: `1px dashed ${formData.proofFile ? ind.accent : ind.hairline}`,
                              color: formData.proofFile ? ind.ink : ind.inkFaint,
                            }}
                          >
                            <Upload size={16} strokeWidth={1.5} style={{ flex: 'none' }} />
                            <span style={{ fontFamily: BODY, fontSize: 11.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {formData.proofFile ? formData.proofFile.name : t('timeClock.fileTypes')}
                            </span>
                            {formData.proofFile && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFormData({ ...formData, proofFile: null });
                                }}
                                aria-label={t('common.close', 'Close')}
                                style={{ ...iconBtnStyle, marginLeft: 'auto' }}
                              >
                                <X size={12} strokeWidth={1.5} />
                              </button>
                            )}
                          </label>
                          <input
                            id="proof-file-upload"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                          {errors.proofFile && <p style={errorTextStyle}>{errors.proofFile}</p>}
                        </div>
                      </div>

                      {canManageTimeTracking && (
                        <div
                          className="flex flex-wrap items-center"
                          style={{ gap: 10, paddingTop: 12, borderTop: `1px solid ${ind.rule}` }}
                        >
                          <Tag ind={ind} variant="outline">{t('timeClock.adminTag', 'Admin')}</Tag>
                          <div
                            className="flex items-center"
                            style={{ flex: 1, minWidth: 160, gap: 8, padding: '5px 10px', border: `1px solid ${ind.hairline}` }}
                          >
                            <Search size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                            <span
                              style={{
                                fontFamily: BODY, fontSize: 12, color: ind.inkMuted, minWidth: 0,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {t('timeClock.filingFor', 'Filing for: {name}').replace('{name}', meName)}
                            </span>
                          </div>
                          <Btn ind={ind} onClick={() => handleSegChange('bulk')}>
                            {t('timeClock.changeEmployee', 'Change employee')}
                          </Btn>
                        </div>
                      )}
                    </div>

                    {/* Consequence — the only figure on this card */}
                    <div
                      className="w-full lg:w-[212px] lg:shrink-0 lg:border-l lg:pl-6 flex flex-col"
                      style={{ borderColor: ind.rule }}
                    >
                      <Kicker ind={ind}>{t('timeClock.willRecord', 'This entry will record')}</Kicker>
                      <div className="flex items-baseline" style={{ gap: 6, margin: '4px 0 0' }}>
                        <span style={{ ...figure(60, ind.ink), lineHeight: 0.92 }}>{formHours.toFixed(1)}</span>
                        <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{t('timeClock.hrs')}</span>
                      </div>
                      <p style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, margin: '8px 0 0', lineHeight: 1.5 }}>
                        {formData.hourType === 'on_leave'
                          ? hourTypes.find((type) => type.value === 'on_leave')?.label
                          : `${formData.clockIn || '--:--'} → ${formData.clockOut || '--:--'} · ${hourTypes.find((type) => type.value === formData.hourType)?.label || ''}`}
                      </p>

                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ind.rule}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                          <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                            {t('timeClock.weekBecomes', 'This week becomes')}
                          </span>
                          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                            {weekProjected.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                          <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                            {t('timeClock.remainingOf', 'Remaining of {n}h').replace('{n}', String(CONTRACT_WEEK_HOURS))}
                          </span>
                          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                            {weekRemaining.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div style={{ flex: 1, minHeight: 16 }} />

                      <Btn
                        ind={ind}
                        onClick={() => setFormData({ ...formData, clockIn: STANDARD_CLOCK_IN, clockOut: STANDARD_CLOCK_OUT })}
                        disabled={formData.hourType === 'on_leave'}
                        style={{ width: '100%', marginBottom: 8 }}
                      >
                        {t('timeClock.fillStandard', 'Fill {from} – {to}')
                          .replace('{from}', STANDARD_CLOCK_IN)
                          .replace('{to}', STANDARD_CLOCK_OUT)}
                      </Btn>
                      {/* The single solid object on this card. */}
                      <Btn
                        ind={ind}
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                        style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                        {isSubmitting ? t('timeClock.submitting') : t('timeClock.submit')}
                      </Btn>
                    </div>
                  </div>
                </Blueprint>
              </form>

              {/* ── HISTORY ────────────────────────────────────────── */}
              <div ref={historySectionRef} className="scroll-mt-24 flex-1 min-w-0">
                <Blueprint ind={ind} style={{ padding: '14px 18px 12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div className="flex flex-wrap items-end justify-between" style={{ gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <ColumnHeading ind={ind}>{t('timeClock.history', 'Time Entry History')}</ColumnHeading>
                      <p style={captionStyle}>
                        {t('timeClock.midnightNote', 'Shifts crossing midnight are counted against the day they started.')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                      <FlatSelect
                        ind={ind}
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          if (e.target.value !== 'pending') setReviewMode(false);
                        }}
                        aria-label={t('timeClock.filterByStatus', 'Status')}
                      >
                        <option value="all">{t('timeClock.allStatuses', 'All Statuses')}</option>
                        <option value="pending">{t('status.pending', 'Pending')}</option>
                        <option value="approved">{t('status.approved', 'Approved')}</option>
                        <option value="rejected">{t('status.rejected', 'Rejected')}</option>
                      </FlatSelect>
                    </div>
                  </div>

                  {reviewMode && (
                    <div style={{ marginTop: 12, border: `1px solid ${ind.hairline}`, background: ind.accentWash, padding: '9px 12px' }}>
                      <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>
                        {t('timeClock.reviewPendingBanner', 'Showing time entries awaiting your review')}
                      </span>
                    </div>
                  )}

                  {getSortedEntries.length === 0 ? (
                    <div style={{ padding: '48px 0', textAlign: 'center' }}>
                      <Clock size={28} strokeWidth={1} style={{ color: ind.inkFaint, margin: '0 auto 10px' }} />
                      <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, margin: 0 }}>
                        {statusFilter === 'pending'
                          ? t('timeClock.noPendingEntries', 'No pending time entries to review')
                          : t('timeClock.noEntries')}
                      </p>
                    </div>
                  ) : (
                    <TableScroll className="mt-3">
                      <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <SortableTh ind={ind} style={{ ...thStyle, width: showEmployeeColumn ? '11%' : '15%' }} active={sortKey === 'date'} dir={sortDirection} onClick={() => handleSort('date')}>
                              {t('timeClock.date', 'Date')}
                            </SortableTh>
                            {showEmployeeColumn && (
                              <SortableTh ind={ind} style={{ ...thStyle, width: '17%' }} active={sortKey === 'employee'} dir={sortDirection} onClick={() => handleSort('employee')}>
                                {t('timeClock.employee', 'Employee')}
                              </SortableTh>
                            )}
                            <th className={colTimeClass} style={{ ...thStyle, width: '14%' }}>{t('timeClock.time', 'Time')}</th>
                            <SortableTh ind={ind} style={{ ...thStyle, width: '8%', textAlign: 'right' }} active={sortKey === 'hours'} dir={sortDirection} onClick={() => handleSort('hours')}>
                              {t('timeClock.hours', 'Hours')}
                            </SortableTh>
                            <SortableTh ind={ind} className={colTypeClass} style={{ ...thStyle, width: '17%' }} active={sortKey === 'type'} dir={sortDirection} onClick={() => handleSort('type')}>
                              {t('timeClock.type', 'Type')}
                            </SortableTh>
                            <SortableTh ind={ind} style={{ ...thStyle, width: '13%' }} active={sortKey === 'status'} dir={sortDirection} onClick={() => handleSort('status')}>
                              {t('timeClock.status', 'Status')}
                            </SortableTh>
                            <th style={{ ...thStyle, width: '10%', textAlign: 'center' }}>{t('timeClock.proof', 'Proof')}</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>{t('timeClock.actions', 'Actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedEntries.map((entry) => {
                            const isEditing = editingEntryId === entry.id;
                            const editable = canEditEntry(entry);
                            const entryType = entry.hour_type || entry.hourType;
                            const typeLabel = hourTypes.find((type) => type.value === entryType)?.label || entryType;
                            const timeText = entryType === 'on_leave'
                              ? '—'
                              : `${formatTime(entry.clock_in || entry.clockIn)} – ${formatTime(entry.clock_out || entry.clockOut)}`;

                            return (
                              <tr key={entry.id} style={isEditing ? { background: ind.accentWash } : undefined}>
                                <td style={{ ...tdStyle, fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                                  {isEditing ? (
                                    <DatePicker
                                      flat
                                      value={editForm.date}
                                      onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                                    />
                                  ) : (
                                    <>
                                      {entry.date || formatDate(entry.created_at, currentLanguage)}
                                      {/* Stand-ins for the columns this viewport dropped */}
                                      <StackedDetail showUntil="md" label={t('timeClock.type', 'Type')} value={typeLabel} />
                                      <StackedDetail showUntil="lg" label={t('timeClock.time', 'Time')} value={timeText} />
                                    </>
                                  )}
                                </td>

                                {showEmployeeColumn && (
                                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {isDemoMode()
                                      ? (getDemoEmployeeName(
                                        { name: entry.employee_name || entry.employee?.name, nameKey: entry.employee_nameKey },
                                        t
                                      ) || entry.employee_name || entry.employee?.name || '—')
                                      : (entry.employee_name || entry.employee?.name || '—')}
                                  </td>
                                )}

                                <td className={colTimeClass} style={{ ...tdStyle, color: ind.inkGhost }}>
                                  {isEditing ? (
                                    editForm.hourType === 'on_leave' ? '—' : (
                                      <div className="flex items-center" style={{ gap: 4 }}>
                                        <TimePicker flat value={editForm.clockIn} onChange={(e) => handleEditTimeChange('clockIn', e.target.value)} />
                                        <TimePicker flat value={editForm.clockOut} onChange={(e) => handleEditTimeChange('clockOut', e.target.value)} />
                                      </div>
                                    )
                                  ) : timeText}
                                </td>

                                <td style={{ ...tdStyle, fontFamily: DISPLAY, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      value={editForm.hours}
                                      disabled={editForm.hourType === 'on_leave'}
                                      onChange={(e) => handleEditHoursChange(e.target.value)}
                                      className={cn(editInputClass, 'text-right')}
                                      style={editInputStyle}
                                    />
                                  ) : Number(entry.hours || 0).toFixed(1)}
                                </td>

                                <td className={colTypeClass} style={tdStyle}>
                                  {isEditing ? (
                                    <select
                                      value={editForm.hourType}
                                      onChange={(e) => handleEditTypeChange(e.target.value)}
                                      className={editInputClass}
                                      style={editInputStyle}
                                    >
                                      {hourTypes.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkGhost }}>{typeLabel}</span>
                                  )}
                                </td>

                                <td style={tdStyle}>
                                  <Tag ind={ind} variant={statusVariant(entry.status)}>{translateStatus(entry.status)}</Tag>
                                </td>

                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  {entry.proof_file_url ? (
                                    isImageFile(entry.proof_file_type, entry.proof_file_url) ? (
                                      <button
                                        type="button"
                                        onClick={() => setImagePreview({ show: true, url: entry.proof_file_url })}
                                        title={t('timeClock.viewProof', 'View proof image')}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ind.accent }}
                                      >
                                        <FileCheck size={15} strokeWidth={1.5} />
                                      </button>
                                    ) : (
                                      <a
                                        href={entry.proof_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={t('timeClock.downloadProof', 'Download proof file')}
                                        style={{ color: ind.accent, display: 'inline-flex' }}
                                      >
                                        <FileCheck size={15} strokeWidth={1.5} />
                                      </a>
                                    )
                                  ) : isLeaveHistoryRow(entry) ? (
                                    <span style={{ color: ind.inkFaint }}>—</span>
                                  ) : (
                                    <label
                                      htmlFor={`proof-upload-${entry.id}`}
                                      title={t('timeClock.uploadProof', 'Upload proof file')}
                                      style={{
                                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 10,
                                        letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted,
                                      }}
                                    >
                                      {uploadingProofId === entry.id ? (
                                        <>
                                          <Loader2 size={12} className="animate-spin" />
                                          {Object.values(uploadProgress)[0] > 0 && `${Object.values(uploadProgress)[0]}%`}
                                        </>
                                      ) : (
                                        t('timeClock.proofMissing', 'Missing')
                                      )}
                                      <input
                                        id={`proof-upload-${entry.id}`}
                                        type="file"
                                        accept="image/*,application/pdf,.doc,.docx,.txt"
                                        className="sr-only"
                                        disabled={uploadingProofId === entry.id}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            handleUploadProof(entry.id, file);
                                            e.target.value = '';
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </td>

                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                  <div className="flex items-center justify-end" style={{ gap: 4 }}>
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={saveEditEntry}
                                          disabled={savingEntryId === entry.id}
                                          title={t('common.save', 'Save')}
                                          style={iconBtnStyle}
                                        >
                                          {savingEntryId === entry.id
                                            ? <Loader2 size={12} className="animate-spin" />
                                            : <Check size={12} strokeWidth={1.5} />}
                                        </button>
                                        <button type="button" onClick={cancelEditEntry} title={t('common.cancel', 'Cancel')} style={iconBtnStyle}>
                                          <X size={12} strokeWidth={1.5} />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {entry.status === 'pending' && canApprove(entry) && (
                                          <button
                                            type="button"
                                            onClick={() => handleApprove(entry.id)}
                                            disabled={approvingEntryId === entry.id}
                                            title={t('timeClock.approve', 'Approve')}
                                            style={{ ...iconBtnStyle, borderColor: ind.accent, color: ind.accent }}
                                          >
                                            {approvingEntryId === entry.id
                                              ? <Loader2 size={12} className="animate-spin" />
                                              : <Check size={12} strokeWidth={1.5} />}
                                          </button>
                                        )}
                                        {editable && (
                                          <button type="button" onClick={() => startEditEntry(entry)} title={t('common.edit', 'Edit')} style={iconBtnStyle}>
                                            <Pencil size={11} strokeWidth={1.5} />
                                          </button>
                                        )}
                                        {!isLeaveHistoryRow(entry) && (
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(entry.id, entry)}
                                            title={entry.proof_file_url ? t('timeClock.deleteOptions', 'Delete options') : t('timeClock.delete', 'Delete')}
                                            style={iconBtnStyle}
                                          >
                                            <X size={12} strokeWidth={1.5} />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TableScroll>
                  )}

                  <div style={{ flex: 1, minHeight: 12 }} />

                  <div
                    className="flex flex-wrap items-center justify-between"
                    style={{ gap: 10, paddingTop: 10, borderTop: `1px solid ${ind.rule}` }}
                  >
                    <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>
                      {t('timeClock.showingCount', 'Showing {n} of {total} entries')
                        .replace('{n}', String(getSortedEntries.length))
                        .replace('{total}', String(Array.isArray(timeEntries) ? timeEntries.length : 0))}
                      {ledgerRangeLabel && ` · ${ledgerRangeLabel}`}
                    </span>
                    {(statusFilter !== 'all' || reviewMode) && (
                      <button
                        type="button"
                        onClick={() => { setStatusFilter('all'); setReviewMode(false); }}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                          textTransform: 'uppercase', color: ind.accentDeep,
                        }}
                      >
                        {t('timeClock.showAll', 'Show all')} →
                      </button>
                    )}
                  </div>
                </Blueprint>
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT — 372px. 340 is too narrow for label + figure + bar. ── */}
        <aside
          className="w-full lg:w-[372px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, minWidth: 0 }}
        >
          {/* Week */}
          <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('timeClock.weeklySummary')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {`${weekTotal.toFixed(1)} ${t('timeClock.hrs')}`}
              </span>
            </div>
            <p style={captionStyle}>{weekRangeLabel}</p>
          </div>

          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: `1px solid ${ind.hairline}` }}>
            {weekBreakdown.map((row) => {
              const live = row.hours > 0;
              return (
                <div key={row.value}>
                  <div className="flex items-baseline justify-between" style={{ gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: BODY, fontSize: 12.5, color: live ? ind.ink : ind.inkFaint, minWidth: 0 }}>
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5,
                        color: live ? ind.ink : ind.inkFaint,
                        whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {row.hours.toFixed(1)}
                    </span>
                  </div>
                  {/* The bar is a hairline box with a fill inside, never a coloured box. */}
                  <Bar
                    ind={ind}
                    value={weekPeak > 0 ? row.hours / weekPeak : 0}
                    fill={row.hours === weekPeak && weekPeak > 0 ? ind.accent : rampAt(ind, 2)}
                    height={6}
                  />
                </div>
              );
            })}

            <div className="flex items-baseline justify-between" style={{ gap: 8, paddingTop: 10, borderTop: `1px solid ${ind.rule}` }}>
              <ColumnHeading ind={ind} style={{ fontSize: 12 }}>{t('timeClock.total')}</ColumnHeading>
              <span style={{ ...figure(20, ind.ink) }}>
                {weekTotal.toFixed(1)}
                <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{` ${t('timeClock.hrs')}`}</span>
              </span>
            </div>
          </div>

          {/* Month */}
          <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${ind.hairline}` }}>
            <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
              <ColumnHeading ind={ind}>{t('timeClock.monthlySummary')}</ColumnHeading>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: ind.accent, whiteSpace: 'nowrap' }}>
                {`${monthTotal.toFixed(1)} ${t('timeClock.hrs')}`}
              </span>
            </div>
            <p style={captionStyle}>{monthLabel}</p>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthTop && (
                <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                  <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink, minWidth: 0 }}>{monthTop.label}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {monthTop.hours.toFixed(1)}
                  </span>
                </div>
              )}
              {/* The other types collapse to one line: five zeroes stacked is not
                  information, it is furniture. */}
              <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkFaint, minWidth: 0 }}>
                  {t('timeClock.otherTypes', '{n} other types').replace('{n}', String(monthRest.length))}
                </span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, color: ind.inkFaint, fontVariantNumeric: 'tabular-nums' }}>
                  {monthRest.reduce((acc, row) => acc + row.hours, 0).toFixed(1)}
                </span>
              </div>
              <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, minWidth: 0 }}>
                  {t('timeClock.leaveDays', 'Leave Days')}
                </span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {`${leaveWeek.toFixed(1)} / ${leaveMonth.toFixed(1)} ${t('timeClock.days')}`}
                </span>
              </div>

              <div className="flex items-baseline justify-between" style={{ gap: 8, paddingTop: 10, borderTop: `1px solid ${ind.rule}` }}>
                <ColumnHeading ind={ind} style={{ fontSize: 12 }}>{t('timeClock.total')}</ColumnHeading>
                <span style={{ ...figure(20, ind.ink) }}>
                  {monthTotal.toFixed(1)}
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>{` ${t('timeClock.hrs')}`}</span>
                </span>
              </div>
            </div>

            <p style={{ ...captionStyle, fontStyle: 'italic', marginTop: 10 }}>
              {t('timeClock.includesPending', '* Includes pending & approved')}
            </p>
          </div>

          {/* Bulk — the entry point, not a second copy of the form */}
          {canManageTimeTracking && (
            <div style={{ padding: '18px 20px 20px' }}>
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <ColumnHeading ind={ind} style={{ fontSize: 14 }}>
                  {t('adminTimeEntry.bulkStandardHours.title', 'Bulk standard hours')}
                </ColumnHeading>
                <Tag ind={ind} variant="outline">{t('timeClock.adminTag', 'Admin')}</Tag>
              </div>
              <p style={captionStyle}>
                {t('timeClock.bulkExplain', 'File a standard {from}–{to} day for every active employee across a date range. Weekends are skipped.')
                  .replace('{from}', STANDARD_CLOCK_IN)
                  .replace('{to}', STANDARD_CLOCK_OUT)}
              </p>
              <Btn
                ind={ind}
                variant="primary"
                onClick={() => handleSegChange('bulk')}
                style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Users size={13} strokeWidth={1.5} />
                {t('timeClock.openBulk', 'Open bulk entry')}
              </Btn>
              <p style={{ ...captionStyle, marginTop: 8 }}>
                {t('timeClock.bulkScope', '{n} active employees on file')
                  .replace('{n}', String(Array.isArray(allEmployees) ? allEmployees.length : 0))}
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Upload toast ──────────────────────────────────────────── */}
      {uploadToast.show && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 60 }}>
          <div
            className="flex items-center"
            style={{
              gap: 10, padding: '10px 14px', background: ind.ground,
              border: `1px solid ${uploadToast.type === 'success' ? ind.hairline : ind.ink}`,
              borderLeft: `3px solid ${uploadToast.type === 'success' ? ind.accent : ind.ink}`,
            }}
          >
            {uploadToast.type === 'success'
              ? <Check size={14} strokeWidth={1.5} style={{ color: ind.accentDeep, flex: 'none' }} />
              : <AlertCircle size={14} strokeWidth={1.5} style={{ color: ind.ink, flex: 'none' }} />}
            <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{uploadToast.message}</span>
          </div>
        </div>
      )}

      {/* ── Leave request modal ───────────────────────────────────── */}
      {showLeaveModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,45,61,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLeaveModal(false); }}
        >
          <Blueprint ind={ind} style={{ background: ind.ground, width: '100%', maxWidth: 420 }}>
            <form onSubmit={handleLeaveSubmit} style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flex items-start justify-between" style={{ gap: 10 }}>
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

              <div>
                <span style={fieldLabelStyle}>{t('timeTracking.leaveType', 'Leave Type')}</span>
                <FlatSelect
                  ind={ind}
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="vacation">{t('timeTracking.vacation', 'Vacation')}</option>
                  <option value="sick">{t('timeTracking.sickLeave', 'Sick Leave')}</option>
                  <option value="personal">{t('timeTracking.personal', 'Personal Leave')}</option>
                  <option value="unpaid">{t('timeTracking.unpaid', 'Unpaid Leave')}</option>
                </FlatSelect>
              </div>

              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={fieldLabelStyle}>{t('timeTracking.startDate', 'Start Date')}</span>
                  <DatePicker
                    flat
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={fieldLabelStyle}>{t('timeTracking.endDate', 'End Date')}</span>
                  <DatePicker
                    flat
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <span style={fieldLabelStyle}>{t('timeTracking.reason', 'Reason')}</span>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder={t('timeTracking.reasonPlaceholder', 'Briefly explain your leave request...')}
                  style={{
                    width: '100%', height: 62, padding: '7px 10px', resize: 'vertical',
                    border: `1px solid ${ind.hairline}`, borderRadius: 0,
                    background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 12.5,
                  }}
                />
              </div>

              <div className="flex items-center justify-end" style={{ gap: 8, paddingTop: 4 }}>
                <Btn ind={ind} onClick={() => setShowLeaveModal(false)}>{t('common.cancel', 'Cancel')}</Btn>
                <Btn ind={ind} variant="primary" type="submit" disabled={loading}>
                  {t('common.leaveRequest', 'Submit Request')}
                </Btn>
              </div>
            </form>
          </Blueprint>
        </div>
      )}

      {/* ── Proof preview ─────────────────────────────────────────── */}
      {imagePreview.show && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,45,61,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setImagePreview({ show: false, url: '' })}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagePreview({ show: false, url: '' })}
              aria-label={t('common.close', 'Close')}
              style={{
                position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: ind.ground, border: `1px solid ${ind.ink}`, color: ind.ink,
                borderRadius: 0, cursor: 'pointer',
              }}
            >
              <X size={15} strokeWidth={1.5} />
            </button>
            <img
              src={imagePreview.url}
              alt={t('timeClock.proof')}
              style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block', border: `1px solid ${ind.hairline}` }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <div style={{ display: 'none', background: ind.ground, padding: 24, textAlign: 'center' }}>
              <p style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, margin: 0 }}>
                {t('timeClock.proofLoadFailed', 'This file could not be displayed.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeClockEntry;
