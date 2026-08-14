/**
 * Bulk scope of 3a (timeClockEntry.jsx) — filing hours *for other people*.
 *
 * Rendered into the left band of the time clock screen when the scope seg is set
 * to "Bulk", so it deliberately has no shell of its own: the page head, ticker
 * and padding already belong to the parent. What it contributes is two
 * blueprints — the multi-employee entry form, and the standard-hours fill.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius 0, cards are
 * outlines with four registration corners, the primary button is the only solid
 * object on the card, and status reads through weight and rule rather than
 * red/green — which is why the success and failure banners here differ by their
 * border weight and icon, not by colour.
 */
import _React, { useState, useEffect, useMemo } from 'react';
import { Clock, Save, X, Search, AlertCircle, Calendar, LogIn, LogOut, Check, Upload, Users, CalendarRange } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as timeTrackingService from '../services/timeTrackingService.js';
import { supabase } from '../config/supabaseClient.js';
import { isDemoMode, MOCK_EMPLOYEES, getDemoEmployeeName } from '../utils/demoHelper.js';
import { useSessionGuard } from '../hooks/useSessionGuard.js';
import { SpecularButton } from './ui/specular-button';
import { DatePicker } from './ui/date-picker.jsx';
import { TimePicker } from './ui/time-picker.jsx';
import { cn } from '@/lib/utils';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Tag, Btn, Kicker, ColumnHeading } from './ui/industry.jsx';
import {
  getHoursWorked,
  toExtendedInterval,
  extendedIntervalsOverlap,
} from '../utils/timeEntryHelpers.js';

const ClockInIcon = ({ className, ...props }) => (
  <LogIn {...props} className={cn(className, 'rotate-180')} />
);

const AdminTimeEntry = ({ onEntriesChanged }) => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();
  const { user, checkPermission } = useAuth();
  const { handleSessionAuthError } = useSessionGuard();

  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    hourType: 'regular',
    notes: '',
    proofFile: null
  });

  const [bulkFillData, setBulkFillData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [bulkFillLoading, setBulkFillLoading] = useState(false);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);

  const getBulkFillErrorMessage = (error) => {
    if (!error) {
      return t('adminTimeEntry.bulkStandardHours.errorGeneric', 'Failed to fill standard hours. Please try again.');
    }

    if (error.includes('End date must be on or after')) {
      return t('adminTimeEntry.bulkStandardHours.invalidRange', 'End date must be on or after start date');
    }

    if (error.includes('Date range cannot exceed')) {
      const maxMatch = error.match(/(\d+)/);
      return t('adminTimeEntry.bulkStandardHours.rangeTooLarge', 'Date range cannot exceed {max} days')
        .replace('{max}', maxMatch?.[1] || '366');
    }

    if (error === 'No employees found') {
      return t('adminTimeEntry.bulkStandardHours.noEmployeesFound', 'No employees found to fill hours for.');
    }

    if (error === 'Invalid date range') {
      return t('adminTimeEntry.bulkStandardHours.invalidDate', 'Invalid date range.');
    }

    return t('adminTimeEntry.bulkStandardHours.errorWithDetail', 'Failed to fill standard hours: {message}')
      .replace('{message}', error);
  };

  const isOnLeave = formData.hourType === 'on_leave';

  // Check if user has permission
  const canManageTimeTracking = checkPermission('canManageTimeTracking');

  /**
   * Chips, not a select. The list is short and fixed, and the choice changes
   * what the figure on the right of the card says — the same grammar the
   * single-entry form on this screen uses.
   */
  const hourTypes = [
    { value: 'regular', label: t('adminTimeEntry.hourTypes.regular', 'Regular Hours') },
    { value: 'overtime', label: t('adminTimeEntry.hourTypes.overtime', 'Overtime') },
    { value: 'weekend', label: t('adminTimeEntry.hourTypes.weekend', 'Weekend/Overtime') },
    { value: 'holiday', label: t('adminTimeEntry.hourTypes.holiday', 'Holiday') },
    { value: 'bonus', label: t('adminTimeEntry.hourTypes.bonus', 'Bonus Hours') },
    { value: 'wfh', label: t('adminTimeEntry.hourTypes.wfh', 'Working From Home (Online)') },
    { value: 'on_leave', label: t('adminTimeEntry.hourTypes.onLeave', 'On Leave') }
  ];

  useEffect(() => {
    if (canManageTimeTracking) {
      fetchEmployees();
    }
  }, [canManageTimeTracking]);

  // When switching to on-leave, clear any existing times so the UI shows empty fields
  useEffect(() => {
    if (isOnLeave) {
      setFormData((prev) => ({ ...prev, clockIn: '', clockOut: '' }));
    }
  }, [isOnLeave]);

  // Auto-hide success message after a short timeout
  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(''), 1500); // 1.5s
    return () => clearTimeout(id);
  }, [successMessage]);

  const fetchEmployees = async () => {
    if (isDemoMode()) {
      setEmployees(MOCK_EMPLOYEES);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, position, department, status')
        // Don't filter by status - allow admins to manage time entries for all employees (including inactive/terminated)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      if (handleSessionAuthError(error)) {
        return;
      }
      setErrorMessage(t('adminTimeEntry.errorLoadEmployees', 'Failed to load employees'));
    }
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 50MB to match service configuration)
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(t('timeClock.errors.fileTooLarge', 'File size must be less than 50MB'));
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage(t('timeClock.errors.invalidFileType', 'Only images, PDF, and document files are allowed'));
        return;
      }

      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, proofFile: { name: file.name, type: file.type, data: reader.result } });
        setErrorMessage('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove uploaded file
  const handleRemoveFile = () => {
    setFormData({ ...formData, proofFile: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('Submit - Selected employees:', selectedEmployees);

    if (selectedEmployees.length === 0) {
      setErrorMessage(t('adminTimeEntry.selectAtLeastOne', 'Please select at least one employee'));
      return;
    }

    if (!isOnLeave && (!formData.clockIn || !formData.clockOut)) {
      setErrorMessage('Please enter both clock in and clock out times');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const LEAVE_CLOCK_IN = '09:00:00';
      const LEAVE_CLOCK_OUT = '09:01:00';

      // Format times as HH:MM:SS for PostgreSQL time type
      const clockInTime = isOnLeave ? LEAVE_CLOCK_IN : `${formData.clockIn}:00`;
      const clockOutTime = isOnLeave ? LEAVE_CLOCK_OUT : `${formData.clockOut}:00`;

      const hours = isOnLeave ? 0 : getHoursWorked(formData.date, formData.clockIn, formData.clockOut);

      if (!isOnLeave && hours <= 0) {
        setErrorMessage(t('timeClock.errors.clockOutAfterClockIn', 'Clock out must be after clock in'));
        setLoading(false);
        return;
      }

      if (!isOnLeave && hours > 24) {
        setErrorMessage(t('timeClock.errors.tooManyHours', 'Shift cannot exceed 24 hours'));
        setLoading(false);
        return;
      }

      // Upload proof file if exists (will be shared across all entries)
      let proofFileUrl = null;
      let proofFileName = null;
      let proofFileType = null;
      let proofFilePath = null;

      if (formData.proofFile) {
        // Convert base64 back to file for upload
        const base64Data = formData.proofFile.data;
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Create File object - use first employee's ID for upload
        const file = new File([byteArray], formData.proofFile.name, {
          type: formData.proofFile.type,
          lastModified: Date.now()
        });

        const uploadResult = await timeTrackingService.uploadProofFile(file, selectedEmployees[0].id);
        if (uploadResult.success) {
          proofFileUrl = uploadResult.url;

          // Fix for Demo Mode with IndexedDB fallback:
          // If uploadProofFile returns null URL (because it used IndexedDB),
          // use a temporary Blob URL so it shows up in the table immediately.
          if (!proofFileUrl && isDemoMode()) {
            proofFileUrl = URL.createObjectURL(file);
          }

          proofFileName = uploadResult.fileName;
          proofFileType = uploadResult.fileType;
          proofFilePath = uploadResult.storagePath;
        } else {
          setErrorMessage(`Failed to upload proof file: ${uploadResult.error}`);
          setLoading(false);
          return;
        }
      }

      // Check for overlapping time entries for the selected employees on this date with the same hour type
      const timeStringToSeconds = (value) => {
        if (value == null) return null;
        const str = typeof value === 'string' ? value : String(value);
        // Accept HH:MM, HH:MM:SS, and variants like HH:MM:SS+00
        const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        const seconds = Number(match[3] || 0);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
        return hours * 3600 + minutes * 60 + seconds;
      };

      const employeeIds = selectedEmployees.map(e => e.id);
      let existingEntries = [];
      let checkError = null;

      if (isDemoMode()) {
        existingEntries = [];
      } else {
        const { data, error } = await supabase
          .from('time_entries')
          .select('employee_id, date, hour_type, clock_in, clock_out')
          .in('employee_id', employeeIds)
          .eq('date', formData.date)
          .eq('hour_type', formData.hourType);
        existingEntries = data;
        checkError = error;
      }

      if (checkError) {
        console.error('Error checking existing entries:', checkError);
        setErrorMessage(t('adminTimeEntry.errors.checkFailed', 'Failed to check for existing entries'));
        setLoading(false);
        return;
      }

      // Check for time overlaps for each employee
      const employeesWithOverlaps = [];
      const employeesWithoutOverlaps = [];

      const newClockInSeconds = isOnLeave ? null : timeStringToSeconds(clockInTime);
      const newClockOutSeconds = isOnLeave ? null : timeStringToSeconds(clockOutTime);

      for (const emp of selectedEmployees) {
        const empExistingEntries = existingEntries.filter(e => String(e.employee_id) === String(emp.id));
        let hasOverlap = false;

        if (!isOnLeave) {
          if (newClockInSeconds == null || newClockOutSeconds == null) {
            setErrorMessage(t('adminTimeEntry.errors.invalidTime', 'Invalid clock-in or clock-out time'));
            setLoading(false);
            return;
          }

          for (const entry of empExistingEntries) {
            const existingClockInSeconds = timeStringToSeconds(entry.clock_in);
            const existingClockOutSeconds = timeStringToSeconds(entry.clock_out);
            if (existingClockInSeconds == null || existingClockOutSeconds == null) continue;

            // Overlap check using half-open intervals: [start, end)
            // Supports overnight shifts when clock-out is earlier than clock-in.
            const newInterval = toExtendedInterval(newClockInSeconds, newClockOutSeconds);
            const existingInterval = toExtendedInterval(existingClockInSeconds, existingClockOutSeconds);
            const isOverlapping = extendedIntervalsOverlap(newInterval, existingInterval);

            if (isOverlapping) {
              hasOverlap = true;
              break;
            }
          }
        }

        if (hasOverlap) {
          employeesWithOverlaps.push(emp);
        } else {
          employeesWithoutOverlaps.push(emp);
        }
      }

      // If all employees have overlapping entries, show error
      if (employeesWithoutOverlaps.length === 0) {
        const names = employeesWithOverlaps.map(e => e.name).join(', ');
        const hourTypeKey = formData.hourType.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const hourTypeLabel = t(
          `adminTimeEntry.hourTypes.${hourTypeKey}`,
          t(`timeClock.hourTypes.${hourTypeKey}`, formData.hourType)
        );
        setErrorMessage(t('adminTimeEntry.errors.allOverlapping', 'All selected employees have overlapping {hourType} time entries for {date}: {names}').replace('{hourType}', hourTypeLabel).replace('{date}', formData.date).replace('{names}', names));
        setLoading(false);
        return;
      }

      // Show warning if some employees have overlapping entries
      if (employeesWithOverlaps.length > 0) {
        const names = employeesWithOverlaps.map(e => e.name).join(', ');
        console.log(`Skipping employees with overlapping ${formData.hourType} entries: ${names}`);
      }

      const employeesWithoutEntries = employeesWithoutOverlaps;
      const employeesWithEntries = employeesWithOverlaps;

      // Create entries only for employees without existing entries
      const entries = employeesWithoutEntries.map(emp => ({
        employeeId: emp.id,
        date: formData.date,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        hours: parseFloat(hours.toFixed(2)),
        hourType: formData.hourType,
        notes: formData.notes || `Entered by admin: ${user.full_name || user.email}`,
        status: 'approved', // Admin entries are auto-approved
        proofFileUrl,
        proofFileName,
        proofFileType,
        proofFilePath
      }));

      console.log('Submitting entries:', entries);
      const result = await timeTrackingService.createBulkTimeEntries(entries);
      console.log('Result from service:', result);

      if (result.success) {
        const processedNames = employeesWithoutEntries.map(e => e.name).join(', ');
        const _processedIds = employeesWithoutEntries.map(e => e.id);
        const hourTypeKey = formData.hourType.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const hourTypeLabel = t(
          `adminTimeEntry.hourTypes.${hourTypeKey}`,
          t(`timeClock.hourTypes.${hourTypeKey}`, formData.hourType)
        );

        let message = employeesWithoutEntries.length === 1
          ? `${hourTypeLabel} ${t('adminTimeEntry.entryAddedSuccess', 'time entry added successfully for')} ${processedNames}`
          : `${hourTypeLabel} ${t('adminTimeEntry.entriesAddedSuccess', 'time entries added successfully for')} ${employeesWithoutEntries.length} ${t('adminTimeEntry.employees', 'employees')}: ${processedNames}`;

        // Add warning about skipped employees if any
        if (employeesWithEntries.length > 0) {
          const skippedNames = employeesWithEntries.map(e => e.name).join(', ');
          message += ` (${t('adminTimeEntry.skippedEmployees', 'Skipped {count} employee(s) with existing {hourType} entries: {names}').replace('{count}', employeesWithEntries.length).replace('{hourType}', hourTypeLabel).replace('{names}', skippedNames)})`;
        }

        setSuccessMessage(message);
        // Reset form and allow all employees to be selectable again
        setFormData({
          date: new Date().toISOString().split('T')[0],
          clockIn: '',
          clockOut: '',
          hourType: 'regular',
          notes: '',
          proofFile: null
        });
        setSelectedEmployees([]);
        setSearchTerm('');
        // Notify parent component to refresh time entries
        if (onEntriesChanged) {
          onEntriesChanged();
        }
      } else {
        console.error('Service returned error:', result.error);
        setErrorMessage(t('adminTimeEntry.error', 'Failed to create time entries'));
      }
    } catch (error) {
      console.error('Error submitting time entries:', error);
      if (handleSessionAuthError(error)) return;
      console.error('Error details:', error.message, error.stack);
      setErrorMessage(t('adminTimeEntry.error', 'Failed to create time entries'));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStandardHoursFill = (e) => {
    e.preventDefault();

    if (bulkFillData.endDate < bulkFillData.startDate) {
      setErrorMessage(t('adminTimeEntry.bulkStandardHours.invalidRange', 'End date must be on or after start date'));
      return;
    }

    setShowBulkConfirmModal(true);
  };

  const executeBulkStandardHoursFill = async () => {
    setShowBulkConfirmModal(false);
    setBulkFillLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await timeTrackingService.fillStandardHoursForAllEmployees({
        startDate: bulkFillData.startDate,
        endDate: bulkFillData.endDate,
        adminName: user.full_name || user.email
      });

      if (result.success) {
        if (result.created === 0) {
          setSuccessMessage(
            result.noWeekdaysInRange
              ? t(
                  'adminTimeEntry.bulkStandardHours.noWeekdaysInRange',
                  'No entries were created. The selected range contains only weekends, which are excluded automatically.'
                )
              : t(
                  'adminTimeEntry.bulkStandardHours.noEntriesCreated',
                  'No entries were created. All employees already have overlapping entries for the selected dates.'
                )
          );
        } else {
          setSuccessMessage(
            t(
              'adminTimeEntry.bulkStandardHours.success',
              'Created {created} standard hour entries across {dates} weekday(s) for {employees} employee(s). Skipped {skipped} slot(s) with existing entries. Excluded {weekends} weekend day(s).'
            )
              .replace('{created}', String(result.created))
              .replace('{dates}', String(result.datesProcessed))
              .replace('{employees}', String(result.employeesProcessed))
              .replace('{skipped}', String(result.skipped))
              .replace('{weekends}', String(result.weekendsExcluded || 0))
          );
        }

        if (onEntriesChanged) {
          onEntriesChanged();
        }
      } else {
        setErrorMessage(getBulkFillErrorMessage(result.error));
      }
    } catch (error) {
      console.error('Error filling standard hours:', error);
      if (handleSessionAuthError(error)) return;
      setErrorMessage(getBulkFillErrorMessage(error.message || error.toString()));
    } finally {
      setBulkFillLoading(false);
    }
  };

  const toggleEmployeeSelection = (employee) => {
    setSelectedEmployees(prev => {
      const isSelected = prev.some(e => e.id === employee.id);
      return isSelected
        ? prev.filter(e => e.id !== employee.id)
        : [...prev, employee];
    });
  };

  const removeEmployee = (employeeId) => {
    setSelectedEmployees(prev => prev.filter(e => e.id !== employeeId));
  };

  // Filter out employees who have already had entries created in this session
  const filteredEmployees = employees.filter(emp => {
    // Don't show employees that are already selected
    if (selectedEmployees.some(e => e.id === emp.id)) return false;

    // Apply search filter
    return (
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  /* ---------------------------------------------------------------- *
   * Shared type — the same scale the single-entry form on this screen
   * uses, so the two scopes read as one page.
   * ---------------------------------------------------------------- */

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

  /** Btn's type, applied inside SpecularButton where its own classes reach. */
  const specularLabelStyle = {
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  };

  const iconBtnStyle = {
    width: 20,
    height: 20,
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

  /** The hours a single row of this submission will carry. */
  const formHours = useMemo(() => {
    if (isOnLeave) return 0;
    const value = getHoursWorked(formData.date, formData.clockIn, formData.clockOut);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [isOnLeave, formData.date, formData.clockIn, formData.clockOut]);

  const selectedCount = selectedEmployees.length;
  const hourTypeLabel = hourTypes.find((type) => type.value === formData.hourType)?.label || '';

  if (!canManageTimeTracking) {
    return (
      <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
        <div style={{ minWidth: 0 }}>
          <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
          <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>
            {t('adminTimeEntry.accessDenied', 'Access Denied: You don\'t have permission to manage time entries for other employees.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {/* ── Banners — weight and icon carry the verdict, not colour ─── */}
      {successMessage && (
        <div
          className="flex items-start justify-between"
          style={{ border: `1px solid ${ind.hairline}`, background: ind.accentWash, padding: '9px 12px', gap: 10 }}
        >
          <span style={{ fontFamily: BODY, fontSize: 12.5, color: ind.ink }}>{successMessage}</span>
          <Check size={14} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.accentDeep }} />
        </div>
      )}

      {errorMessage && (
        <div style={{ border: `1px solid ${ind.ink}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
            <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            aria-label={t('common.close', 'Close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* ── ENTRY FORM ───────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <Blueprint ind={ind} style={{ padding: '18px 20px 16px' }}>
          <div className="flex flex-col lg:flex-row" style={{ gap: 28 }}>

            {/* Collect */}
            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 14 }}>
              <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <ColumnHeading ind={ind}>{t('adminTimeEntry.title', 'Admin Time Entry')}</ColumnHeading>
                  <p style={captionStyle}>
                    {t('adminTimeEntry.description', 'Enter time entries for employees (Admin/Manager only)')}
                  </p>
                </div>
                <Tag ind={ind} variant="outline">{t('timeClock.adminTag', 'Admin')}</Tag>
              </div>

              {/* Employees */}
              <div>
                <label htmlFor="admin-employee-search" style={fieldLabelStyle}>
                  {t('adminTimeEntry.selectEmployees', 'Select Employees')}
                </label>

                <div
                  className="flex items-center"
                  style={{ gap: 8, padding: '5px 10px', border: `1px solid ${ind.hairline}` }}
                >
                  <Search size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                  <input
                    id="admin-employee-search"
                    type="text"
                    placeholder={t('adminTimeEntry.searchEmployees', 'Search employees...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                      color: ind.ink, fontFamily: BODY, fontSize: 12.5, padding: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, letterSpacing: '.08em',
                      textTransform: 'uppercase', color: ind.inkFaint, flex: 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {`${selectedCount} ${t('adminTimeEntry.selected', 'selected')}`}
                  </span>
                </div>

                {/* Results — only while searching, same as before */}
                {searchTerm && (
                  <div
                    style={{
                      maxHeight: 192, overflowY: 'auto',
                      borderLeft: `1px solid ${ind.hairline}`,
                      borderRight: `1px solid ${ind.hairline}`,
                      borderBottom: `1px solid ${ind.hairline}`,
                    }}
                  >
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleEmployeeSelection(emp)}
                          className="w-full flex items-center justify-between"
                          style={{
                            gap: 10, padding: '7px 10px', textAlign: 'left', cursor: 'pointer',
                            background: 'transparent', border: 'none',
                            borderTop: `1px solid ${ind.rule}`, borderRadius: 0,
                            transition: 'background .15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = ind.hover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span
                              style={{
                                display: 'block', fontFamily: BODY, fontSize: 13, color: ind.ink,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {getDemoEmployeeName(emp, t)}
                            </span>
                            <span
                              style={{
                                display: 'block', fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {`${t(`employeePosition.${emp.position}`, emp.position)} · ${t(`employeeDepartment.${emp.department}`, emp.department)}`}
                            </span>
                          </span>
                          <span style={{ ...iconBtnStyle, pointerEvents: 'none' }}>
                            <Check size={12} strokeWidth={1.5} style={{ opacity: 0.35 }} />
                          </span>
                        </button>
                      ))
                    ) : (
                      <p style={{ ...captionStyle, margin: 0, padding: '10px' }}>
                        {t('adminTimeEntry.noEmployees', 'No employees found')}
                      </p>
                    )}
                  </div>
                )}

                {/* Selected */}
                {selectedCount > 0 ? (
                  <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                    {selectedEmployees.map((emp) => (
                      <span
                        key={emp.id}
                        className="inline-flex items-center"
                        style={{ gap: 8, padding: '4px 6px 4px 9px', border: `1px solid ${ind.hairline}`, maxWidth: '100%' }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block', fontFamily: BODY, fontSize: 12.5, color: ind.ink,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            {getDemoEmployeeName(emp, t)}
                          </span>
                          <span
                            style={{
                              display: 'block', fontFamily: BODY, fontSize: 11, color: ind.inkFaint,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            {t(`employeePosition.${emp.position}`, emp.position)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEmployee(emp.id)}
                          aria-label={t('common.remove', 'Remove')}
                          style={iconBtnStyle}
                        >
                          <X size={11} strokeWidth={1.5} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={captionStyle}>
                    {t('adminTimeEntry.searchHint', 'Search by name, email or position, then pick everyone this entry is filed for.')}
                  </p>
                )}
              </div>

              {/* When */}
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="admin-date-input" style={fieldLabelStyle}>
                    {t('adminTimeEntry.date', 'Date')}
                  </label>
                  <DatePicker
                    flat
                    id="admin-date-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    icon={Calendar}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label htmlFor="admin-clockin-input" style={fieldLabelStyle}>
                    {t('adminTimeEntry.clockIn', 'Clock In')}
                  </label>
                  <TimePicker
                    flat
                    id="admin-clockin-input"
                    value={isOnLeave ? '' : formData.clockIn}
                    onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                    required={!isOnLeave}
                    disabled={isOnLeave}
                    defaultOpenTime="09:00"
                    icon={ClockInIcon}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label htmlFor="admin-clockout-input" style={fieldLabelStyle}>
                    {t('adminTimeEntry.clockOut', 'Clock Out')}
                  </label>
                  <TimePicker
                    flat
                    id="admin-clockout-input"
                    value={isOnLeave ? '' : formData.clockOut}
                    onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                    required={!isOnLeave}
                    disabled={isOnLeave}
                    defaultOpenTime="17:00"
                    icon={LogOut}
                  />
                </div>
              </div>

              {/* Hour type */}
              <div>
                <span style={fieldLabelStyle}>{t('adminTimeEntry.hourType', 'Hour Type')}</span>
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
              </div>

              {/* Notes + proof */}
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="admin-notes-textarea" style={fieldLabelStyle}>
                    {`${t('adminTimeEntry.notes', 'Notes')} · ${t('timeClock.optional', 'Optional')}`}
                  </label>
                  <textarea
                    id="admin-notes-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('adminTimeEntry.notesPlaceholder', 'Add any notes about this time entry...')}
                    style={{
                      width: '100%', height: 62, padding: '7px 10px', resize: 'vertical',
                      border: `1px solid ${ind.hairline}`, borderRadius: 0,
                      background: 'transparent', color: ind.ink,
                      fontFamily: BODY, fontSize: 12.5,
                    }}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <span style={fieldLabelStyle}>
                    {`${t('timeClock.proof', 'Proof of Work')} · ${t('timeClock.optional', 'Optional')}`}
                  </span>
                  <label
                    htmlFor="admin-proof-file"
                    className="flex items-center"
                    style={{
                      height: 62, gap: 10, padding: '0 12px', cursor: 'pointer',
                      border: `1px dashed ${formData.proofFile ? ind.accent : ind.hairline}`,
                      color: formData.proofFile ? ind.ink : ind.inkFaint,
                    }}
                  >
                    <Upload size={16} strokeWidth={1.5} style={{ flex: 'none' }} />
                    <span style={{ fontFamily: BODY, fontSize: 11.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formData.proofFile
                        ? `${formData.proofFile.name} · ${(formData.proofFile.data.length / 1024 / 1024).toFixed(2)} MB`
                        : t('timeClock.fileTypes', 'Supports: Images, PDF, Documents (Max 50MB)')}
                    </span>
                    {formData.proofFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                        aria-label={t('common.close', 'Close')}
                        style={{ ...iconBtnStyle, marginLeft: 'auto' }}
                      >
                        <X size={11} strokeWidth={1.5} />
                      </button>
                    )}
                  </label>
                  <input
                    id="admin-proof-file"
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.txt"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </div>
              </div>
            </div>

            {/* Consequence — the only figure on this card */}
            <div
              className="w-full lg:w-[212px] lg:shrink-0 lg:border-l lg:pl-6 flex flex-col"
              style={{ borderColor: ind.rule }}
            >
              <Kicker ind={ind}>{t('adminTimeEntry.willFile', 'This will file')}</Kicker>
              <div className="flex items-baseline" style={{ gap: 6, margin: '4px 0 0' }}>
                <span style={{ ...figure(60, ind.ink), lineHeight: 0.92 }}>{formHours.toFixed(1)}</span>
                <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>{t('timeClock.hrs', 'hrs')}</span>
              </div>
              <p style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted, margin: '8px 0 0', lineHeight: 1.5 }}>
                {isOnLeave
                  ? hourTypeLabel
                  : `${formData.clockIn || '--:--'} → ${formData.clockOut || '--:--'} · ${hourTypeLabel}`}
              </p>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ind.rule}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                    {t('adminTimeEntry.selectedEmployees', 'Selected Employees')}
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {selectedCount}
                  </span>
                </div>
                <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                  <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted }}>
                    {t('adminTimeEntry.totalHoursFiled', 'Total hours filed')}
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {(formHours * selectedCount).toFixed(1)}
                  </span>
                </div>
              </div>

              <p style={{ ...captionStyle, marginTop: 10 }}>
                {t('adminTimeEntry.autoApprovedNote', '* Entries filed here are approved on submission')}
              </p>

              <div style={{ flex: 1, minHeight: 16 }} />

              {/* The single solid object on this card. */}
              <Btn
                ind={ind}
                variant="primary"
                type="submit"
                disabled={loading || selectedCount === 0}
                style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {loading
                  ? <Clock size={13} strokeWidth={1.5} className="animate-spin" />
                  : <Save size={13} strokeWidth={1.5} />}
                {loading
                  ? t('adminTimeEntry.submitting', 'Submitting...')
                  : selectedCount > 1
                    ? t('adminTimeEntry.submitBulkEntries', 'Submit Entries for {0} Employees').replace('{0}', selectedCount)
                    : t('adminTimeEntry.submitButton', 'Submit Time Entry')}
              </Btn>
            </div>
          </div>
        </Blueprint>
      </form>

      {/* ── BULK STANDARD HOURS — the tinted card on this screen ──── */}
      <form onSubmit={handleBulkStandardHoursFill}>
        <Blueprint ind={ind} tint style={{ padding: '18px 20px 16px' }}>
          <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 10 }}>
            <ColumnHeading ind={ind}>
              {t('adminTimeEntry.bulkStandardHours.title', 'Bulk Standard Hours')}
            </ColumnHeading>
            <Tag ind={ind} variant="outline">{t('timeClock.adminTag', 'Admin')}</Tag>
          </div>
          <p style={captionStyle}>
            {t(
              'adminTimeEntry.bulkStandardHours.description',
              'Automatically create 9:00 AM – 5:00 PM regular hour entries for all employees on weekdays only. Saturdays and Sundays are excluded. Existing overlapping entries are skipped.'
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-end" style={{ gap: 12, marginTop: 14 }}>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="admin-bulk-start-date" style={fieldLabelStyle}>
                {t('adminTimeEntry.bulkStandardHours.startDate', 'Start Date')}
              </label>
              <DatePicker
                flat
                id="admin-bulk-start-date"
                value={bulkFillData.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  setBulkFillData((prev) => ({
                    startDate,
                    endDate: prev.endDate < startDate ? startDate : prev.endDate
                  }));
                }}
                max={new Date().toISOString().split('T')[0]}
                required
                icon={Calendar}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <label htmlFor="admin-bulk-end-date" style={fieldLabelStyle}>
                {t('adminTimeEntry.bulkStandardHours.endDate', 'End Date')}
              </label>
              <DatePicker
                flat
                id="admin-bulk-end-date"
                value={bulkFillData.endDate}
                onChange={(e) => setBulkFillData((prev) => ({ ...prev, endDate: e.target.value }))}
                min={bulkFillData.startDate}
                max={new Date().toISOString().split('T')[0]}
                required
                icon={Calendar}
              />
            </div>

            {/* Re-skinned to the system rather than replaced: the sheen is what
                marks this as the action that touches every employee at once. */}
            <SpecularButton
              type="submit"
              disabled={bulkFillLoading || loading}
              shineOnHover
              className="w-full rounded-none border"
              style={{
                padding: '7px 12px',
                borderRadius: 0,
                background: ind.accent,
                color: ind.accentInk,
                borderColor: ind.accent,
              }}
            >
              {/* The sheen's own label span carries Tailwind's text-sm /
                  normal-case, so the system's type has to be set here. */}
              {bulkFillLoading ? (
                <>
                  <Clock size={13} strokeWidth={1.5} className="animate-spin" />
                  <span style={specularLabelStyle}>
                    {t('adminTimeEntry.bulkStandardHours.filling', 'Filling standard hours...')}
                  </span>
                </>
              ) : (
                <>
                  <CalendarRange size={13} strokeWidth={1.5} />
                  <span style={specularLabelStyle}>
                    {t('adminTimeEntry.bulkStandardHours.fillButton', 'Fill 9 AM – 5 PM for All Employees')}
                  </span>
                </>
              )}
            </SpecularButton>
          </div>

          <p style={{ ...captionStyle, marginTop: 10 }}>
            {t('adminTimeEntry.bulkScopeNote', '* {n} employees on file')
              .replace('{n}', String(employees.length))}
          </p>
        </Blueprint>
      </form>

      {/* ── Confirm ──────────────────────────────────────────────── */}
      {showBulkConfirmModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,45,61,.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBulkConfirmModal(false); }}
        >
          <Blueprint
            ind={ind}
            style={{ background: ind.ground, width: '100%', maxWidth: 420 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-fill-confirm-title"
          >
            <div style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flex items-start justify-between" style={{ gap: 10 }}>
                <div id="bulk-fill-confirm-title" style={{ minWidth: 0 }}>
                  <ColumnHeading ind={ind}>
                    {t('adminTimeEntry.bulkStandardHours.confirmTitle', 'Confirm Bulk Standard Hours')}
                  </ColumnHeading>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmModal(false)}
                  aria-label={t('common.close', 'Close')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0, flex: 'none' }}
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex" style={{ gap: 12, alignItems: 'flex-start' }}>
                <Users size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.inkMuted }} />
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.55, margin: 0 }}>
                  {t(
                    'adminTimeEntry.bulkStandardHours.confirmMessage',
                    'Create 9 AM – 5 PM regular hour entries for all employees from {start} to {end}? Saturdays and Sundays will be excluded. Employees with overlapping entries will be skipped.'
                  )
                    .replace('{start}', bulkFillData.startDate)
                    .replace('{end}', bulkFillData.endDate)}
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end" style={{ gap: 8, paddingTop: 4, borderTop: `1px solid ${ind.rule}` }}>
                <Btn ind={ind} onClick={() => setShowBulkConfirmModal(false)}>
                  {t('adminTimeEntry.bulkStandardHours.cancelButton', 'Cancel')}
                </Btn>
                <Btn ind={ind} variant="primary" onClick={executeBulkStandardHoursFill}>
                  {t('adminTimeEntry.bulkStandardHours.confirmButton', 'Yes, Fill Hours')}
                </Btn>
              </div>
            </div>
          </Blueprint>
        </div>
      )}
    </div>
  );
};

export default AdminTimeEntry;
