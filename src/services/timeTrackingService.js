import { fetchAllRows } from '../utils/fetchAllRows.js';
import { supabase } from '../config/supabaseClient';
import { isDemoMode, MOCK_EMPLOYEES, MOCK_TIME_ENTRIES, getDemoLeaveRequests, addDemoLeaveRequest, updateDemoLeaveRequest, calculateDaysBetween, getDemoTimeEntries, addDemoTimeEntry, deleteDemoTimeEntry, getDemoEmployeeById } from '../utils/demoHelper';
import { saveDemoBlob } from '../utils/demoStorage';
import { toExtendedInterval, extendedIntervalsOverlap, getMonthDateRange } from '../utils/timeEntryHelpers.js';
import { workingDateKeys, workingDaySegments } from '../utils/reportExportHelpers.js';
import {
  approvedLeaveDateKeys,
  approvedLeaveDateKeysByEmployee,
  attendancePeriodRange,
  dateKey,
  emptyAttendanceTotals,
  isDateKeyInMonth,
  summarizeAttendance,
} from '../utils/attendanceRules.js';
import { getDocumentDownloadUrl } from './documentService.js';

const toEmployeeId = (id) => {
  return id ? String(id) : null;
};

export const createTimeEntry = async (timeEntryData) => {
  if (isDemoMode()) {
    // Look up employee info to attach to the entry for display
    const emp = getDemoEmployeeById(timeEntryData.employeeId);
    
    // Handle proof file in demo mode - save to demo storage
    let proofFileUrl = timeEntryData.proofFileUrl || null;
    let proofFileName = timeEntryData.proofFileName || null;
    let proofFileType = timeEntryData.proofFileType || null;
    let proofFilePath = timeEntryData.proofFilePath || null;
    
    // If we have a proof file blob/data, save it to demo storage
    if (timeEntryData.proofFileUrl && timeEntryData.proofFileUrl.startsWith('blob:')) {
      // Convert blob URL to data URL for persistence
      try {
        const response = await fetch(timeEntryData.proofFileUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        proofFileUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Failed to convert blob URL for demo storage', e);
      }
    }
    
    const demoEntry = {
      id: `demo-entry-${Date.now()}`,
      ...timeEntryData,
      employee_id: timeEntryData.employeeId,
      employee_name: emp?.name || 'Unknown',
      employee_nameKey: emp?.nameKey || null,
      employee_department: emp?.department || null,
      employee_position: emp?.position || null,
      hour_type: timeEntryData.hourType,
      clock_in: timeEntryData.clockIn,
      clock_out: timeEntryData.clockOut,
      proof_file_url: proofFileUrl,
      proof_file_name: proofFileName,
      proof_file_type: proofFileType,
      proof_file_path: proofFilePath,
      employee: emp ? {
        id: emp.id,
        name: emp.name,
        nameKey: emp.nameKey,
        department: emp.department,
        position: emp.position
      } : null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    // Persist to localStorage
    try { addDemoTimeEntry(demoEntry); } catch (e) { console.warn('Failed to persist demo time entry', e); }
    return { success: true, data: demoEntry };
  }

  try {
    const employeeId = toEmployeeId(timeEntryData.employeeId);
    
    // Validate employee exists first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error('Error checking employee:', employeeError);
      throw new Error('Failed to validate employee');
    }

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} does not exist. Please make sure the employee is registered in the system before creating time entries.`);
    }

    // Create time entry
    const { data, error } = await supabase
      .from('time_entries')
      .insert([{
        employee_id: employeeId,
        date: timeEntryData.date,
        clock_in: timeEntryData.clockIn,
        clock_out: timeEntryData.clockOut,
        hours: timeEntryData.hours,
        hour_type: timeEntryData.hourType,
        notes: timeEntryData.notes || null,
        proof_file_url: timeEntryData.proofFileUrl || null,
        proof_file_name: timeEntryData.proofFileName || null,
        proof_file_type: timeEntryData.proofFileType || null,
        proof_file_path: timeEntryData.proofFilePath || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      // Provide user-friendly error messages
      if (error.code === '23503') {
        throw new Error('Employee not found. Please ensure the employee exists before creating time entries.');
      }
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error creating time entry:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create time entry'
    };
  }
};

/**
 * Create multiple time entries at once (bulk insert)
 * @param {Array} timeEntriesData - Array of time entry objects
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const createBulkTimeEntries = async (timeEntriesData) => {
  if (isDemoMode()) {
    // Persist demo time entries so they show up across reloads
    const persisted = timeEntriesData.map((entry, i) => {
      // Look up employee info to attach to the entry for display
      const emp = getDemoEmployeeById(entry.employeeId);
      const demoEntry = {
        id: `demo-bulk-${Date.now()}-${i}`,
        ...entry,
        employee_id: entry.employeeId,
        employee_name: emp?.name || 'Unknown',
        employee_nameKey: emp?.nameKey || null,
        employee_department: emp?.department || null,
        employee_position: emp?.position || null,
        hour_type: entry.hourType,
        clock_in: entry.clockIn,
        clock_out: entry.clockOut,
        proof_file_url: entry.proofFileUrl || null,
        proof_file_name: entry.proofFileName || null,
        proof_file_type: entry.proofFileType || null,
        proof_file_path: entry.proofFilePath || null,
        employee: emp ? {
          id: emp.id,
          name: emp.name,
          nameKey: emp.nameKey,
          department: emp.department,
          position: emp.position
        } : null,
        status: entry.status || 'pending',
        created_at: new Date().toISOString()
      };
      try { addDemoTimeEntry(demoEntry); } catch (e) { console.warn('Failed to persist demo time entry', e); }
      return demoEntry;
    });
    return { success: true, data: persisted };
  }

  try {
    if (!Array.isArray(timeEntriesData) || timeEntriesData.length === 0) {
      throw new Error('No time entries provided');
    }

    // Validate all employees exist first
    const employeeIds = [...new Set(timeEntriesData.map(entry => toEmployeeId(entry.employeeId)))];
    const { data: employees, error: employeeError } = await fetchAllRows(supabase
      .from('employees')
      .select('id', { count: 'exact' })
      .in('id', employeeIds));

    if (employeeError) {
      console.error('Error checking employees:', employeeError);
      throw new Error('Failed to validate employees');
    }

    // Check if all employees exist
    const foundIds = new Set(employees.map(e => String(e.id)));
    const missingIds = employeeIds.filter(id => !foundIds.has(String(id)));
    
    if (missingIds.length > 0) {
      throw new Error(`Employees not found: ${missingIds.join(', ')}`);
    }

    // Format entries for bulk insert
    const formattedEntries = timeEntriesData.map(entry => ({
      employee_id: toEmployeeId(entry.employeeId),
      date: entry.date,
      clock_in: entry.clockIn,
      clock_out: entry.clockOut,
      hours: entry.hours,
      hour_type: entry.hourType,
      notes: entry.notes || null,
      proof_file_url: entry.proofFileUrl || null,
      proof_file_name: entry.proofFileName || null,
      proof_file_type: entry.proofFileType || null,
      proof_file_path: entry.proofFilePath || null,
      status: entry.status || 'pending'
    }));

    // Bulk insert all entries
    const { data, error } = await supabase
      .from('time_entries')
      .insert(formattedEntries)
      .select();

    if (error) {
      console.error('Error creating bulk time entries:', error);
      if (error.code === '23503') {
        throw new Error('One or more employees not found. Please ensure all employees exist.');
      }
      throw error;
    }
    
    return { 
      success: true, 
      data,
      count: data.length 
    };
  } catch (error) {
    console.error('Error creating bulk time entries:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create time entries',
      code: error.code
    };
  }
};

const STANDARD_CLOCK_IN = '09:00:00';
const STANDARD_CLOCK_OUT = '17:00:00';
const STANDARD_HOURS = 8;
const MAX_BULK_FILL_DAYS = 366;
const BULK_STANDARD_NOTE_PREFIX = 'Standard hours filled by admin:';

const bulkStandardNote = (adminName, notes) => {
  const stamp = `${BULK_STANDARD_NOTE_PREFIX} ${adminName}`;
  if (!notes) return stamp;
  if (String(notes).startsWith(BULK_STANDARD_NOTE_PREFIX)) return String(notes);
  return `${stamp}. ${notes}`;
};

const isBulkStandardEntry = (entry) => {
  const hourType = entry?.hour_type || entry?.hourType;
  const notes = entry?.notes || '';
  return hourType === 'regular'
    && String(notes).startsWith(BULK_STANDARD_NOTE_PREFIX)
    && timeStringToSeconds(entry.clock_in ?? entry.clockIn) === timeStringToSeconds(STANDARD_CLOCK_IN)
    && timeStringToSeconds(entry.clock_out ?? entry.clockOut) === timeStringToSeconds(STANDARD_CLOCK_OUT);
};

const timeStringToSeconds = (value) => {
  if (value == null) return null;
  const str = typeof value === 'string' ? value : String(value);
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return hours * 3600 + minutes * 60 + seconds;
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const buildDateRange = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid date range' };
  }
  if (end < start) {
    return { error: 'End date must be on or after start date' };
  }

  const calendarDayCount = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (calendarDayCount > MAX_BULK_FILL_DAYS) {
    return { error: `Date range cannot exceed ${MAX_BULK_FILL_DAYS} days` };
  }

  const dates = [];
  let weekendsExcluded = 0;
  const current = new Date(start);
  while (current <= end) {
    if (isWeekend(current)) {
      weekendsExcluded += 1;
    } else {
      dates.push(formatLocalDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    dates,
    weekendsExcluded,
    noWeekdaysInRange: dates.length === 0 && weekendsExcluded > 0
  };
};

const hasOverlappingEntry = (existingEntries, clockInSeconds, clockOutSeconds) => {
  const newInterval = toExtendedInterval(clockInSeconds, clockOutSeconds);

  for (const entry of existingEntries) {
    const existingClockInSeconds = timeStringToSeconds(entry.clock_in);
    const existingClockOutSeconds = timeStringToSeconds(entry.clock_out);
    if (existingClockInSeconds == null || existingClockOutSeconds == null) continue;

    const existingInterval = toExtendedInterval(existingClockInSeconds, existingClockOutSeconds);
    if (extendedIntervalsOverlap(newInterval, existingInterval)) return true;
  }
  return false;
};

/**
 * Approval cleanup. Removes only rows the bulk fill created — same employee,
 * a Monday–Friday date inside the approved range, hour_type 'regular',
 * 09:00–17:00 and the bulk note — so hand-entered attendance, overtime and
 * other hour types stay. Running it again for the same request removes nothing.
 */
const removeDemoBulkStandardEntriesForLeave = (leave) => {
  const dates = workingDateKeys(leave?.start_date, leave?.end_date || leave?.start_date);
  if (!dates.length || !leave?.employee_id) return { removed: 0 };
  const ids = getDemoTimeEntries()
    .filter(entry => String(entry.employee_id) === String(leave.employee_id)
      && dates.includes(dateKey(entry.date)) && isBulkStandardEntry(entry))
    .map(entry => entry.id);
  ids.forEach(id => deleteDemoTimeEntry(id));
  return { removed: ids.length };
};

/**
 * Create standard 9 AM – 5 PM regular hour entries for all employees across a date range.
 * Skips employees/dates that already have overlapping entries,
 * and weekdays already covered by an approved leave request.
 */
export const fillStandardHoursForAllEmployees = async ({
  startDate,
  endDate = startDate,
  adminName = 'Admin',
  hourType = 'regular',
  employeeIds = null,
  notes = null
}, retryAttempt = 0) => {
  try {
    const { dates, weekendsExcluded, noWeekdaysInRange, error: rangeError } = buildDateRange(startDate, endDate);
    if (rangeError) {
      return { success: false, error: rangeError };
    }

    if (noWeekdaysInRange) {
      return {
        success: true,
        created: 0,
        skipped: 0,
        datesProcessed: 0,
        weekendsExcluded,
        employeesProcessed: 0,
        noWeekdaysInRange: true
      };
    }

    let employees = [];
    if (isDemoMode()) {
      employees = MOCK_EMPLOYEES.map((emp) => ({ id: emp.id, name: emp.name }));
    } else {
      const { data, error } = await fetchAllRows(supabase
        .from('employees')
        .select('id, name', { count: 'exact' })
        .order('name'));

      if (error) throw error;
      employees = data || [];
    }

    if (employeeIds?.length) {
      const allowedIds = new Set(employeeIds.map((id) => String(id)));
      employees = employees.filter((emp) => allowedIds.has(String(emp.id)));
    }

    if (employees.length === 0) {
      return { success: false, error: 'No employees found' };
    }

    const employeeIdList = employees.map((emp) => emp.id);
    let existingEntries = [];

    if (isDemoMode()) {
      existingEntries = getDemoTimeEntries().filter((entry) =>
        dates.includes(entry.date) &&
        employeeIdList.some((id) => String(id) === String(entry.employee_id))
      );
    } else {
      const { data, error } = await fetchAllRows(supabase
        .from('time_entries')
        .select('employee_id, date, hour_type, clock_in, clock_out', { count: 'exact' })
        .in('employee_id', employeeIdList)
        .in('date', dates));

      if (error) throw error;
      existingEntries = data || [];
    }

    const existingByEmployeeDate = new Map();
    for (const entry of existingEntries) {
      const key = `${entry.employee_id}-${entry.date}`;
      if (!existingByEmployeeDate.has(key)) {
        existingByEmployeeDate.set(key, []);
      }
      existingByEmployeeDate.get(key).push(entry);
    }

    const newClockInSeconds = timeStringToSeconds(STANDARD_CLOCK_IN);
    const newClockOutSeconds = timeStringToSeconds(STANDARD_CLOCK_OUT);
    const defaultNotes = bulkStandardNote(adminName, notes);
    const entriesToCreate = [];
    let skipped = 0;
    let approvedLeave = [];

    if (isDemoMode()) {
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];
      approvedLeave = getDemoLeaveRequests().filter((req) =>
        String(req.status || '').toLowerCase() === 'approved'
        && employeeIdList.some((id) => String(id) === String(req.employee_id))
        && String(req.start_date).slice(0, 10) <= lastDate
        && String(req.end_date || req.start_date).slice(0, 10) >= firstDate
      );
    } else {
      const { data, error } = await fetchAllRows(supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date, status', { count: 'exact' })
        .in('employee_id', employeeIdList)
        .lte('start_date', dates[dates.length - 1])
        .gte('end_date', dates[0])
        .eq('status', 'approved'));

      if (error) throw error;
      approvedLeave = data || [];
    }

    // Read-then-insert: a request approved between this read and the insert
    // below is caught by the database (time_entries_skip_bulk_fill_on_leave
    // drops generated rows that land on an approved-leave weekday), and the
    // approval itself removes generated rows that were already stored.
    const coveredByLeave = approvedLeaveDateKeysByEmployee(approvedLeave, dates[0], dates[dates.length - 1]);

    for (const date of dates) {
      for (const employee of employees) {
        const key = `${employee.id}-${date}`;
        if (coveredByLeave.get(String(employee.id))?.has(date)) {
          skipped += 1;
          continue;
        }
        const dayEntries = existingByEmployeeDate.get(key) || [];

        // The unique key covers every hour type. Also preserve overlapping
        // manual attendance (including WFH) when restoring regular hours.
        if (dayEntries.some(entry => timeStringToSeconds(entry.clock_in) === newClockInSeconds)
            || hasOverlappingEntry(dayEntries, newClockInSeconds, newClockOutSeconds)) {
          skipped += 1;
          continue;
        }

        entriesToCreate.push({
          employeeId: employee.id,
          date,
          clockIn: STANDARD_CLOCK_IN,
          clockOut: STANDARD_CLOCK_OUT,
          hours: STANDARD_HOURS,
          hourType,
          notes: defaultNotes,
          status: 'approved'
        });
      }
    }

    if (entriesToCreate.length === 0) {
      return {
        success: true,
        created: 0,
        skipped,
        datesProcessed: dates.length,
        weekendsExcluded,
        employeesProcessed: employees.length,
        message: 'No entries were created. All employees already have overlapping entries for the selected dates.'
      };
    }

    const result = await createBulkTimeEntries(entriesToCreate);
    if (!result.success) {
      // A competing transaction may have filled the same date. Its failed
      // INSERT is atomic; reread attendance and leave before retrying the batch.
      if (retryAttempt < 2 && ['23505', '40001', '40P01'].includes(result.code)) {
        return fillStandardHoursForAllEmployees({ startDate, endDate, adminName, hourType, employeeIds, notes }, retryAttempt + 1);
      }
      return result;
    }

    // Count what the database stored: its insert guard may have dropped rows
    // for leave approved after the read above.
    const created = Array.isArray(result.data) ? result.data.length : entriesToCreate.length;

    return {
      success: true,
      created,
      skipped: skipped + (entriesToCreate.length - created),
      datesProcessed: dates.length,
      weekendsExcluded,
      employeesProcessed: employees.length,
      data: result.data
    };
  } catch (error) {
    console.error('Error filling standard hours:', error);
    return {
      success: false,
      error: error.message || 'Failed to fill standard hours'
    };
  }
};

/**
 * Get time entries for an employee
 */
export const getTimeEntries = async (employeeId, filters = {}) => {
  if (isDemoMode()) {
    let entries = getDemoTimeEntries().filter(e => String(e.employee_id) === String(employeeId));
    
    if (filters.startDate) {
      entries = entries.filter(e => e.date >= filters.startDate);
    }
    if (filters.endDate) {
      entries = entries.filter(e => e.date <= filters.endDate);
    }
    
    // Sort by date desc
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { success: true, data: entries };
  }

  try {
    let query = supabase
      .from('time_entries')
      .select('*', { count: 'exact' })
      .eq('employee_id', toEmployeeId(employeeId))
      .order('date', { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.hourType) {
      query = query.eq('hour_type', filters.hourType);
    }

    const { data, error } = await fetchAllRows(query);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all time entries with employee details (for HR/managers)
 */
export const getAllTimeEntriesDetailed = async (filters = {}) => {
  if (isDemoMode()) {
    let entries = getDemoTimeEntries();
    
    if (filters.startDate) {
      entries = entries.filter(e => e.date >= filters.startDate);
    }
    if (filters.endDate) {
      entries = entries.filter(e => e.date <= filters.endDate);
    }
    
    if (filters.employeeId) entries = entries.filter(entry => String(entry.employee_id) === String(filters.employeeId));
    if (filters.status) entries = entries.filter((entry) => entry.status === filters.status);
    if (filters.hourTypes) entries = entries.filter((entry) => filters.hourTypes.includes(entry.hour_type));

    // Sort by date desc
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { success: true, data: entries };
  }

  try {
    if (import.meta.env.DEV) console.log('🔧 [Service] getAllTimeEntriesDetailed called with filters:', filters);
    
    let query = supabase
      .from('time_entries_detailed')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', toEmployeeId(filters.employeeId));
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.hourTypes) query = query.in('hour_type', filters.hourTypes);
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }

    if (import.meta.env.DEV) console.log('🔧 [Service] Executing query on time_entries_detailed view...');
    const { data, error } = await fetchAllRows(query);

    if (error) {
      console.error('🔧 [Service] Query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    if (import.meta.env.DEV) console.log('🔧 [Service] Query successful. Rows returned:', data?.length || 0);
    if (data && data.length > 0) {
      if (import.meta.env.DEV) console.log('🔧 [Service] Sample row:', data[0]);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('🔧 [Service] Exception in getAllTimeEntriesDetailed:', error);
    
    // Provide helpful error message if view doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      console.error('🔧 [Service] ⚠️ DATABASE VIEW MISSING! The time_entries_detailed view needs to be created.');
      console.error('🔧 [Service] Run the migration: database_migrations/create_time_entries_detailed_view.sql');
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Update a time entry's editable fields (date, clock times, hours, type)
 */
export const updateTimeEntry = async (entryId, updates = {}) => {
  if (!entryId) {
    return { success: false, error: 'Entry ID is required' };
  }

  const payload = {};
  if (updates.date !== undefined) payload.date = updates.date;
  if (updates.clockIn !== undefined || updates.clock_in !== undefined) {
    payload.clock_in = updates.clockIn ?? updates.clock_in;
  }
  if (updates.clockOut !== undefined || updates.clock_out !== undefined) {
    payload.clock_out = updates.clockOut ?? updates.clock_out;
  }
  if (updates.hours !== undefined) payload.hours = Number(updates.hours);
  if (updates.hourType !== undefined || updates.hour_type !== undefined) {
    payload.hour_type = updates.hourType ?? updates.hour_type;
  }
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.status !== undefined) payload.status = updates.status;

  if (isDemoMode()) {
    const { updateDemoTimeEntry } = await import('../utils/demoHelper');
    const data = updateDemoTimeEntry(entryId, {
      ...payload,
      clockIn: payload.clock_in,
      clockOut: payload.clock_out,
      hourType: payload.hour_type,
    });
    return { success: true, data: { id: entryId, ...data } };
  }

  try {
    const { data, error } = await supabase
      .from('time_entries')
      .update(payload)
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating time entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update time entry status (approve/reject)
 */
export const updateTimeEntryStatus = async (entryId, status, approverId) => {
  if (isDemoMode()) {
    // Persist status update in demo storage
    const { updateDemoTimeEntry } = await import('../utils/demoHelper');
    const updates = {
      status,
      approved_by: approverId,
      approved_at: new Date().toISOString()
    };
    updateDemoTimeEntry(entryId, updates);
    return { success: true, data: { id: entryId, ...updates } };
  }

  try {
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        status,
        approved_by: toEmployeeId(approverId),
        approved_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating time entry status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update proof file for an existing time entry
 * @param {number} entryId - Time entry ID
 * @param {File} file - Proof file to upload
 * @param {string|number} employeeId - Employee ID
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateTimeEntryProof = async (entryId, file, employeeId, onProgress = null) => {
  if (isDemoMode()) {
    // Simulate upload progress for demo mode
    if (onProgress) {
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        onProgress(i);
      }
    }
    // Create a fake URL using object URL or data URL for demo display
    const fakeUrl = URL.createObjectURL(file);
    const updates = {
      proof_file_url: fakeUrl,
      proof_file_name: file.name,
      proof_file_type: file.type,
      proof_file_path: `demo/${employeeId}/${file.name}`
    };
    // Persist to demo storage
    const { updateDemoTimeEntry } = await import('../utils/demoHelper');
    updateDemoTimeEntry(entryId, updates);
    return { success: true, data: { id: entryId, ...updates } };
  }

  try {
    // Upload the proof file with progress tracking
    const uploadResult = await uploadProofFile(file, employeeId, onProgress);
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload proof file');
    }

    // Update the time entry with proof file information
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        proof_file_url: uploadResult.url,
        proof_file_name: uploadResult.fileName,
        proof_file_type: uploadResult.fileType,
        proof_file_path: uploadResult.storagePath
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating time entry proof:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update proof file'
    };
  }
};

/**
 * Delete proof file from storage and update time entry
 * @param {number} entryId - Time entry ID
 * @param {string} filePath - Storage file path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteProofFile = async (entryId, filePath) => {
  if (isDemoMode()) {
    // Update demo entry to remove proof file info
    const { updateDemoTimeEntry } = await import('../utils/demoHelper');
    updateDemoTimeEntry(entryId, {
      proof_file_url: null,
      proof_file_name: null,
      proof_file_type: null,
      proof_file_path: null
    });
    return { success: true };
  }

  try {
    // Delete file from storage if path exists
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('employee-documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue to update database even if storage deletion fails
      }
    }

    // Update the time entry to remove proof file references
    const { data, error } = await supabase
      .from('time_entries')
      .update({
        proof_file_url: null,
        proof_file_name: null,
        proof_file_type: null,
        proof_file_path: null
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error deleting proof file:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete proof file'
    };
  }
};

/**
 * Delete a time entry
 */
export const deleteTimeEntry = async (entryId) => {
  if (isDemoMode()) {
    // Persist deletion in demo storage
    const { deleteDemoTimeEntry } = await import('../utils/demoHelper');
    deleteDemoTimeEntry(entryId);
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Upload proof file to Supabase Storage
 */
/**
 * Upload proof file to Supabase Storage
 * @param {File} file - File to upload
 * @param {string|number} employeeId - Employee ID
 * @returns {Promise<{success: boolean, url?: string, fileName?: string, fileType?: string, storagePath?: string, error?: string}>}
 */
// Sanitize filename to remove special characters
const sanitizeFileName = (name) =>
  name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_]/g, '');

// Enhanced file validation
const validateProofFile = (file) => {
  const maxSize = 50 * 1024 * 1024; // 50MB limit
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    // PDF
    'application/pdf',
    // Documents (optional - for proof of work documents)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (50MB)` };
  }

  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|pdf|docx?|txt)$/i)) {
    return { valid: false, error: 'File type not supported. Please upload an image, PDF, or document file.' };
  }

  return { valid: true };
};

export const uploadProofFile = async (file, employeeId, onProgress = null) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file
    const validation = validateProofFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Sanitize and generate unique filename
    const sanitizedFileName = sanitizeFileName(file.name);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${employeeId}_${timestamp}_${sanitizedFileName}`;
    const filePath = `time-proofs/${fileName}`;

    // Demo mode handling: store in localStorage (small files) or IndexedDB fallback
    if (isDemoMode()) {
      const readAsDataUrl = () => new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = (err) => reject(err);
        fr.readAsDataURL(file);
      });

      try {
        const dataUrl = await readAsDataUrl();
        const demoKey = `demo_time_proof_${toEmployeeId(employeeId)}_${Date.now()}`;
        try {
          localStorage.setItem(demoKey, dataUrl);
          return { success: true, url: dataUrl, fileName: file.name, fileType: file.type, storagePath: demoKey };
        } catch (lsErr) {
          console.warn('⚠️ localStorage setItem failed for proof file, falling back to IndexedDB:', lsErr);
        }
      } catch (readErr) {
        console.warn('⚠️ Failed to read proof file as data URL, will try IndexedDB storage as blob:', readErr);
      }

      // Save blob in IndexedDB
      try {
        const demoKeyIdx = `demo_time_proof_${toEmployeeId(employeeId)}_${Date.now()}`;
        await saveDemoBlob(demoKeyIdx, file);
        return { success: true, url: null, fileName: file.name, fileType: file.type, storagePath: demoKeyIdx };
      } catch (idbErr) {
        console.error('❌ Failed to save demo proof file in IndexedDB:', idbErr);
        return { success: false, error: 'Failed to store proof file in demo mode' };
      }
    }

    // Get signed upload URL from Supabase
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('employee-documents')
      .createSignedUploadUrl(filePath);

    if (signedUrlError) {
      console.error('Error getting signed URL:', signedUrlError);
      throw new Error('Failed to get upload URL');
    }

    // Upload using XMLHttpRequest with progress tracking
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrlData.signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      // Track upload progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            const download = await getDocumentDownloadUrl(filePath);
            resolve({
              success: true,
              url: download.url,
              fileName: file.name,
              fileType: file.type,
              storagePath: filePath
            });
          } catch (error) {
            reject(error);
          }
        } else {
          console.error(`Failed to upload file:`, xhr.responseText);
          reject(new Error('Failed to upload file to storage'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      // Send the file
      xhr.send(file);
    });
  } catch (error) {
    console.error('Error uploading proof file:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to upload proof file'
    };
  }
};

/**
 * Get a fresh, short-lived download URL for an existing proof file.
 * @param {string} filePath - Path to file in storage (e.g., 'time-proofs/123_1234567890.jpg')
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const getProofFileSignedUrl = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    return await getDocumentDownloadUrl(filePath);
  } catch (error) {
    console.error('Error authorizing proof download:', error);
    return {
      success: false,
      error: error.message || 'Failed to authorize proof download'
    };
  }
};

// ============================================
// LEAVE REQUESTS
// ============================================

/**
 * Create a leave request
 */
export const createLeaveRequest = async (leaveData) => {
  if (isDemoMode()) {
    const daysCount = calculateDaysBetween(leaveData.startDate, leaveData.endDate);
    const newLeaveRequest = {
      id: `demo-leave-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      employee_id: leaveData.employeeId,
      leave_type: leaveData.type,
      type: leaveData.type,
      start_date: leaveData.startDate,
      end_date: leaveData.endDate,
      reason: leaveData.reason || null,
      days_count: daysCount,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Persist to localStorage
    addDemoLeaveRequest(newLeaveRequest);
    
    return { 
      success: true, 
      data: newLeaveRequest 
    };
  }

  try {
    const employeeId = toEmployeeId(leaveData.employeeId);
    
    // Validate employee exists first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error('Error checking employee:', employeeError);
      throw new Error('Failed to validate employee');
    }

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} does not exist. Please make sure the employee is registered in the system.`);
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert([{
        employee_id: employeeId,
        leave_type: leaveData.type,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        reason: leaveData.reason || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new Error('Employee not found. Please ensure the employee exists.');
      }
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error creating leave request:', error);
    return { success: false, error: error.message };
  }
};

const LEAVE_LIST_COLUMNS = 'id,employee_id,start_date,end_date,leave_type,status,days_count,submitted_at,approved_by,approved_at,rejection_reason,reason';

/**
 * Resolve the date window a leave-request query is scoped to.
 * Returns null when the caller asked for no scoping at all.
 */
const resolveLeaveRange = (filters = {}) => {
  if (filters.startDate && filters.endDate) {
    return { start: filters.startDate, end: filters.endDate };
  }
  if (filters.rangeStart && filters.rangeEnd) {
    return { start: filters.rangeStart, end: filters.rangeEnd };
  }
  if (filters.year) {
    return { start: `${filters.year}-01-01`, end: `${filters.year}-12-31` };
  }
  return null;
};

const filterLeaveRequestsByRange = (requests, filters = {}) => {
  const range = resolveLeaveRange(filters);
  if (!range) return requests;

  return requests.filter((r) => {
    if (filters.alwaysIncludeStatus && r.status === filters.alwaysIncludeStatus) return true;
    const start = (r.start_date || '').slice(0, 10);
    const end = (r.end_date || r.start_date || '').slice(0, 10);
    return start <= range.end && end >= range.start;
  });
};

const applyLeaveRangeFilter = (query, filters = {}) => {
  const range = resolveLeaveRange(filters);
  if (!range) return query;

  // `alwaysIncludeStatus` widens the window to also admit requests in that
  // status whatever their dates — used so pending approvals dated outside the
  // selected period never drop out of an approver's queue.
  if (filters.alwaysIncludeStatus) {
    return query.or(
      `and(start_date.lte.${range.end},end_date.gte.${range.start}),status.eq.${filters.alwaysIncludeStatus}`
    );
  }

  return query.lte('start_date', range.end).gte('end_date', range.start);
};

/**
 * Get leave requests for an employee
 */
export const getLeaveRequests = async (employeeId, filters = {}) => {
  if (isDemoMode()) {
    // Get leave requests from persistent storage
    let requests = getDemoLeaveRequests();
    
    // Filter by employee if specified
    if (employeeId) {
      requests = requests.filter(r => String(r.employee_id) === String(employeeId));
    }
    
    // Filter by status if specified
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }

    requests = filterLeaveRequestsByRange(requests, filters);
    
    // Sort by start_date descending
    requests.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    
    return { success: true, data: requests };
  }

  try {
    let query = supabase
      .from('leave_requests')
      .select(LEAVE_LIST_COLUMNS)
      .eq('employee_id', toEmployeeId(employeeId))
      .order('start_date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    query = applyLeaveRangeFilter(query, filters);

    const { data, error } = await fetchAllRows(query);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return { success: false, error: error.message };
  }
};

/* Get all leave requests (for HR/managers) */
export const getAllLeaveRequests = async (filters = {}) => {
  if (isDemoMode()) {
    // Get all leave requests from persistent storage
    let requests = getDemoLeaveRequests();
    
    if (filters.employeeId) requests = requests.filter(request => String(request.employee_id) === String(filters.employeeId));
    // Filter by status if specified
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }

    requests = filterLeaveRequestsByRange(requests, filters);
    
    // Sort by created_at descending
    requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return { success: true, data: requests };
  }

  try {
    // Fetch leave requests without relying on a foreign-key relationship in the schema cache
    let query = supabase
      .from('leave_requests')
      .select(LEAVE_LIST_COLUMNS)
      .order('submitted_at', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', toEmployeeId(filters.employeeId));
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    query = applyLeaveRangeFilter(query, filters);

    const { data, error } = await fetchAllRows(query);
    if (error) throw error;

    // If no leave requests, return early
    if (!Array.isArray(data) || data.length === 0) return { success: true, data: [] };

    if (filters.includeEmployeeDetails === false) {
      return { success: true, data };
    }

    // Batch-fetch employee info for requesters and approvers to attach readable names
    const requesterIds = [...new Set(data.map(r => r.employee_id).filter(Boolean))];
    const approverIds = [...new Set(data.map(r => r.approved_by).filter(Boolean))];
    const allIds = [...new Set([...requesterIds, ...approverIds])];

    let employees = [];
    if (allIds.length > 0) {
      const { data: empData, error: empError } = await fetchAllRows(supabase
        .from('employees')
        .select('id, name, department, position', { count: 'exact' })
        .in('id', allIds));

      if (empError) {
        console.error('Error fetching employees for leave requests:', empError);
      } else {
        employees = empData || [];
      }
    }

    const empMap = employees.reduce((acc, e) => { acc[e.id] = e; return acc; }, {});

    const merged = data.map(r => ({
      ...r,
      employee: empMap[r.employee_id] || null,
      approved_by_name: empMap[r.approved_by]?.name || null
    }));

    return { success: true, data: merged };
  } catch (error) {
    console.error('Error fetching all leave requests:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Recreate the generated 09:00–17:00 rows for weekdays that stopped being
 * approved leave. Goes through the Fill Standard Hours helper, so weekends,
 * hand-entered attendance, existing generated rows, overtime and other
 * employees are left alone and running it twice adds nothing.
 */
const restoreStandardHoursForDates = async (employeeId, dates, adminName = 'Admin') => {
  const totals = { success: true, created: 0, skipped: 0 };
  for (const segment of workingDaySegments(dates)) {
    const result = await fillStandardHoursForAllEmployees({
      startDate: segment.start,
      endDate: segment.end,
      adminName,
      employeeIds: [employeeId],
    });
    if (!result.success) return { ...result, created: totals.created, skipped: totals.skipped };
    totals.created += result.created ?? 0;
    totals.skipped += result.skipped ?? 0;
  }
  return totals;
};

export const restoreStandardHoursForLeave = async (leave, adminName = 'Admin') => {
  if (!leave?.employee_id || !leave?.start_date) {
    return { success: false, error: 'Leave request is missing its employee or dates' };
  }
  const dates = workingDateKeys(dateKey(leave.start_date), dateKey(leave.end_date) || dateKey(leave.start_date));
  return restoreStandardHoursForDates(leave.employee_id, dates, adminName);
};

const approvalColumns = (status, approverId, rejectionReason) => (
  status === 'pending'
    ? { approved_by: null, approved_at: null, rejection_reason: null }
    : { approved_by: toEmployeeId(approverId), approved_at: new Date().toISOString(), rejection_reason: rejectionReason }
);

/**
 * After a request changes: an approved request removes the generated rows on
 * its covered weekdays; weekdays that were approved leave before and are not
 * any more get their standard hours back only when the caller asked for it.
 */
const reconcileGeneratedHours = async (previous, current, { restoreStandardHours = false, adminName = 'Admin' } = {}) => {
  const outcome = { removed: null, restored: null };
  if (!current) return outcome;

  // Production cleanup belongs to the leave trigger and commits atomically
  // with approval. A later client DELETE could erase hours restored by a
  // concurrent unapproval. Demo storage has no triggers, so mirror it here.
  if (isDemoMode() && String(current.status || '').toLowerCase() === 'approved') {
    outcome.removed = removeDemoBulkStandardEntriesForLeave(current).removed;
  }

  if (!restoreStandardHours || !previous || String(previous.status || '').toLowerCase() !== 'approved') return outcome;
  const stillCovered = String(current.status || '').toLowerCase() === 'approved'
    && String(current.employee_id) === String(previous.employee_id)
    ? approvedLeaveDateKeys([current])
    : new Set();
  const released = workingDateKeys(dateKey(previous.start_date), dateKey(previous.end_date) || dateKey(previous.start_date))
    .filter((key) => !stillCovered.has(key));
  if (released.length) {
    outcome.restored = await restoreStandardHoursForDates(previous.employee_id, released, adminName);
    if (!outcome.restored.success) {
      outcome.restoreRetry = { employeeId: previous.employee_id, dates: released };
      outcome.warning = `Leave saved; standard-hour restoration failed after ${outcome.restored.created ?? 0} entries: ${outcome.restored.error}`;
    }
  }
  return outcome;
};

const findDemoLeaveRequest = (requestId) =>
  getDemoLeaveRequests().find((req) => String(req.id) === String(requestId)) || null;

const leaveConflict = () => ({
  success: false, code: 'LEAVE_CONFLICT',
  error: 'This leave request changed. Refresh it before trying again.',
});
const LEAVE_EDIT_FIELDS = ['employee_id', 'start_date', 'end_date', 'status', 'leave_type', 'reason'];
const sameLeaveSnapshot = (left, right) => LEAVE_EDIT_FIELDS.every(key =>
  (left?.[key] ?? null) === (right?.[key] ?? null));
const matchPreviousLeave = (query, previous) => {
  for (const key of LEAVE_EDIT_FIELDS) {
    query = previous[key] == null ? query.is(key, null) : query.eq(key, previous[key]);
  }
  return query;
};

/** Explicit retry of exactly the released dates, using the ordinary fill checks. */
export const retryStandardHoursRestoration = ({ employeeId, dates } = {}, adminName = 'Admin') => {
  if (!employeeId || !Array.isArray(dates) || !dates.length
      || dates.some(day => workingDateKeys(day, day).length !== 1)) {
    return Promise.resolve({ success: false, error: 'Invalid restoration dates' });
  }
  return restoreStandardHoursForDates(employeeId, dates, adminName);
};

/**
 * Update leave request status. `options.restoreStandardHours` recreates the
 * generated standard hours when an approved request is reverted or rejected.
 */
export const updateLeaveRequestStatus = async (requestId, status, approverId, rejectionReason = null, options = {}) => {
  if (isDemoMode()) {
    const previous = findDemoLeaveRequest(requestId);
    if (!previous) return { success: false, error: 'Leave request not found' };
    if (options.expectedLeave && !sameLeaveSnapshot(previous, options.expectedLeave)) return leaveConflict();
    const data = updateDemoLeaveRequest(requestId, { status, ...approvalColumns(status, approverId, rejectionReason) })
      || { id: requestId, status };
    const generated = await reconcileGeneratedHours(previous, data, options);
    return { success: true, data, generated };
  }

  try {
    const { data: previous, error: previousError } = await supabase
      .from('leave_requests')
      .select('id, employee_id, start_date, end_date, status, leave_type, reason')
      .eq('id', requestId)
      .maybeSingle();
    if (previousError) throw previousError;
    if (!previous) return { success: false, error: 'Leave request not found' };
    if (options.expectedLeave && !sameLeaveSnapshot(previous, options.expectedLeave)) return leaveConflict();

    const { data, error } = await matchPreviousLeave(supabase
      .from('leave_requests')
      .update({ status, ...approvalColumns(status, approverId, rejectionReason) })
      .eq('id', requestId), previous)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return leaveConflict();
    const generated = await reconcileGeneratedHours(previous, data, options);
    return { success: true, data, generated };
  } catch (error) {
    console.error('Error updating leave request status:', error);
    return { success: false, error: error.message };
  }
};

/** Revert an approved request to pending, optionally refilling its standard hours. */
export const revertLeaveApproval = (requestId, approverId, options = {}) =>
  updateLeaveRequestStatus(requestId, 'pending', approverId, null, options);

/**
 * Edit an existing request (employee, type, dates, reason, status). The
 * database recalculates every month touched by the old and the new range;
 * generated standard hours are reconciled the same way as a status change.
 */
export const updateLeaveRequest = async (requestId, updates = {}, options = {}) => {
  const { approverId = null, rejectionReason = null } = options;
  const payload = {};
  const employeeId = updates.employeeId ?? updates.employee_id;
  const leaveType = updates.leaveType ?? updates.leave_type;
  const startDate = updates.startDate ?? updates.start_date;
  const endDate = updates.endDate ?? updates.end_date;
  if (employeeId != null && employeeId !== '') payload.employee_id = toEmployeeId(employeeId);
  if (leaveType) payload.leave_type = leaveType;
  if (startDate) payload.start_date = dateKey(startDate);
  if (endDate) payload.end_date = dateKey(endDate);
  if (updates.reason !== undefined) payload.reason = updates.reason;
  if (updates.status) Object.assign(payload, { status: updates.status }, approvalColumns(updates.status, approverId, rejectionReason));

  if (payload.start_date && payload.end_date && payload.end_date < payload.start_date) {
    return { success: false, error: 'End date must be on or after start date' };
  }
  if (Object.keys(payload).length === 0) {
    return { success: false, error: 'Nothing to update' };
  }

  if (isDemoMode()) {
    const previous = findDemoLeaveRequest(requestId);
    if (!previous) return { success: false, error: 'Leave request not found' };
    if (options.expectedLeave && !sameLeaveSnapshot(previous, options.expectedLeave)) return leaveConflict();
    const start = payload.start_date || dateKey(previous.start_date);
    const end = payload.end_date || dateKey(previous.end_date) || start;
    if (end < start) return { success: false, error: 'End date must be on or after start date' };
    const data = updateDemoLeaveRequest(requestId, { ...payload, days_count: calculateDaysBetween(start, end) });
    const generated = await reconcileGeneratedHours(previous, data, options);
    return { success: true, data, generated };
  }

  try {
    const { data: previous, error: previousError } = await supabase
      .from('leave_requests')
      .select('id, employee_id, start_date, end_date, status, leave_type, reason')
      .eq('id', requestId)
      .maybeSingle();
    if (previousError) throw previousError;
    if (!previous) return { success: false, error: 'Leave request not found' };
    if (options.expectedLeave && !sameLeaveSnapshot(previous, options.expectedLeave)) return leaveConflict();

    const start = payload.start_date || dateKey(previous.start_date);
    const end = payload.end_date || dateKey(previous.end_date) || start;
    if (end < start) return { success: false, error: 'End date must be on or after start date' };

    const { data, error } = await matchPreviousLeave(supabase
      .from('leave_requests')
      .update(payload)
      .eq('id', requestId), previous)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return leaveConflict();

    const generated = await reconcileGeneratedHours(previous, data, options);
    return { success: true, data, generated };
  } catch (error) {
    console.error('Error updating leave request:', error);
    return { success: false, error: error.message };
  }
};

/* Create an overtime log */
export const createOvertimeLog = async (overtimeData) => {
  if (isDemoMode()) {
    return { 
      success: true, 
      data: { 
        id: `demo-ot-${Date.now()}`,
        ...overtimeData,
        status: 'pending'
      } 
    };
  }

  try {
    const employeeId = toEmployeeId(overtimeData.employeeId);
    
    // Validate employee exists first
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error('Error checking employee:', employeeError);
      throw new Error('Failed to validate employee');
    }

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} does not exist. Please make sure the employee is registered in the system.`);
    }

    const { data, error } = await supabase
      .from('overtime_logs')
      .insert([{
        employee_id: employeeId,
        date: overtimeData.date,
        hours: overtimeData.hours,
        reason: overtimeData.reason,
        overtime_type: overtimeData.overtimeType || 'regular',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new Error('Employee not found. Please ensure the employee exists.');
      }
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error creating overtime log:', error);
    return { success: false, error: error.message };
  }
};

/* Get overtime logs for an employee */
export const getOvertimeLogs = async (employeeId, filters = {}) => {
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

  try {
    let query = supabase
      .from('overtime_logs')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false });

    if (employeeId != null) query = query.eq('employee_id', toEmployeeId(employeeId));
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.month && filters.year) {
      const { startDate, endDate } = getMonthDateRange(filters.month, filters.year);
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await fetchAllRows(query);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching overtime logs:', error);
    return { success: false, error: error.message };
  }
};

/* Update overtime log status */
export const updateOvertimeStatus = async (logId, status, approverId) => {
  if (isDemoMode()) {
    return { success: true, data: { id: logId, status } };
  }

  try {
    const { data, error } = await supabase
      .from('overtime_logs')
      .update({
        status,
        approved_by: toEmployeeId(approverId),
        approved_at: new Date().toISOString()
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating overtime status:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// TIME TRACKING SUMMARY
// ============================================

/* Calculate summary directly from time_entries, leave_requests, and overtime_logs, Matches database function logic exactly */
   
const calculateSummaryFromRawData = async (employeeId, month, year) => {
  try {
    if (import.meta.env.DEV) console.log('🔧 [Service] Calculating summary for employee:', employeeId, 'month:', month, 'year:', year);
    const { startDate, endDate } = getMonthDateRange(month, year);
    if (import.meta.env.DEV) console.log('🔧 [Service] Date range:', startDate, 'to', endDate);
    
    // Get time entries (INCLUDE PENDING AND APPROVED)
    const { data: timeEntries, error: timeError } = await fetchAllRows(supabase
      .from('time_entries')
      .select('*', { count: 'exact' })
      .eq('employee_id', toEmployeeId(employeeId))
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved']));  // CHANGED: include pending
    
    if (import.meta.env.DEV) console.log('🔧 [Service] Time entries found:', timeEntries?.length || 0);
    if (timeError) throw timeError;
    
    // Get leave requests (only approved)
    const { data: leaveRequests, error: leaveError } = await fetchAllRows(supabase
      .from('leave_requests')
      .select('*', { count: 'exact' })
      .eq('employee_id', toEmployeeId(employeeId))
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .eq('status', 'approved'));
    
    if (leaveError) throw leaveError;
    
    // Get overtime logs (INCLUDE PENDING AND APPROVED)
    const { data: overtimeLogs, error: overtimeError } = await fetchAllRows(supabase
      .from('overtime_logs')
      .select('*', { count: 'exact' })
      .eq('employee_id', toEmployeeId(employeeId))
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved']));  // CHANGED: include pending
    
    if (overtimeError) throw overtimeError;

    return {
      employee_id: toEmployeeId(employeeId),
      month,
      year,
      ...summarizeAttendance({ timeEntries, leaveRequests, overtimeLogs, startDate, endDate }),
    };
  } catch (error) {
    console.error('Error calculating summary from raw data:', error);
    throw error;
  }
};

/** Demo mode reads the same sources from local storage and applies the same rules. */
const demoAttendanceSummary = (employeeId, month, year) => {
  const { startDate, endDate } = getMonthDateRange(month, year);
  return summarizeAttendance({
    timeEntries: getDemoTimeEntries(),
    leaveRequests: getDemoLeaveRequests(),
    startDate,
    endDate,
    employeeId,
  });
};

/* Get time tracking summary for an employee */
export const getTimeTrackingSummary = async (employeeId, month, year) => {
  if (isDemoMode()) {
    return {
      success: true,
      data: {
        employee_id: toEmployeeId(employeeId),
        month,
        year,
        ...demoAttendanceSummary(employeeId, month, year),
      },
    };
  }

  try {
    if (import.meta.env.DEV) console.log('🔧 [Service] getTimeTrackingSummary called for employee:', employeeId);
    // Always calculate from time_entries so hour_type=overtime is counted correctly.
    // The summary table can lag behind or use older aggregation that dropped overtime.
    if (import.meta.env.DEV) console.log('🔧 [Service] Calculating summary from time_entries...');
    const calculatedData = await calculateSummaryFromRawData(employeeId, month, year);
    if (import.meta.env.DEV) console.log('🔧 [Service] Calculated data:', calculatedData);
    return { success: true, data: calculatedData };
  } catch (error) {
    console.error('🔧 [Service] Error fetching time tracking summary:', error);
    // Old stored rows may predate the attendance rule; never present them or
    // fabricated zeros as a successful calculation after a source read fails.
    return { success: false, error: error.message, data: null };
  }
};

/* Manually trigger summary update */
export const updateSummary = async (employeeId, month, year) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .rpc('update_time_tracking_summary', {
        p_employee_id: toEmployeeId(employeeId),
        p_month: month,
        p_year: year
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating summary:', error);
    return { success: false, error: error.message };
  }
};

const emptySummary = (employeeId, month, year) => ({
  employee_id: toEmployeeId(employeeId),
  month,
  year,
  ...emptyAttendanceTotals(),
});

const buildDemoOverviewSummaries = (month, year, employees = []) => {
  const { startDate, endDate } = getMonthDateRange(month, year);
  const monthEntries = getDemoTimeEntries().filter((entry) => isDateKeyInMonth(entry.date, month, year));
  const leaveRequests = getDemoLeaveRequests();

  return employees.map((employee) => ({
    employee,
    data: summarizeAttendance({
      timeEntries: monthEntries,
      leaveRequests,
      startDate,
      endDate,
      employeeId: employee.id,
    }),
  }));
};

const aggregateEmployeeSummary = (employeeId, month, year, timeEntries = [], leaveRequests = [], overtimeLogs = []) => {
  const { startDate, endDate } = getMonthDateRange(month, year);
  return {
    ...emptySummary(employeeId, month, year),
    ...summarizeAttendance({ timeEntries, leaveRequests, overtimeLogs, startDate, endDate }),
  };
};

const calculateAllSummariesFromRawData = async (month, year, employees = []) => {
  const { startDate, endDate } = getMonthDateRange(month, year);

  const [timeResult, leaveResult, overtimeResult] = await Promise.all([
    fetchAllRows(supabase
      .from('time_entries')
      .select('employee_id, date, hours, hour_type, status', { count: 'exact' })
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved'])),
    fetchAllRows(supabase
      .from('leave_requests')
      .select('employee_id, start_date, end_date, status', { count: 'exact' })
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .eq('status', 'approved')),
    fetchAllRows(supabase
      .from('overtime_logs')
      .select('employee_id, date, hours, overtime_type, status', { count: 'exact' })
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['pending', 'approved'])),
  ]);

  if (timeResult.error) throw timeResult.error;
  if (leaveResult.error) throw leaveResult.error;
  if (overtimeResult.error) throw overtimeResult.error;

  const groupByEmployee = (rows) => {
    const grouped = new Map();
    (rows || []).forEach((row) => {
      const id = String(row.employee_id);
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(row);
    });
    return grouped;
  };

  const timeByEmployee = groupByEmployee(timeResult.data);
  const leaveByEmployee = groupByEmployee(leaveResult.data);
  const overtimeByEmployee = groupByEmployee(overtimeResult.data);

  const employeeById = new Map(employees.map((emp) => [String(emp.id), emp]));
  // A supplied roster defines the cohort — Overview passes the active employees
  // and expects exactly those rows, including anyone with no entries this month.
  // Without a roster, fall back to whoever the raw data mentions.
  const employeeIds = employeeById.size
    ? new Set(employeeById.keys())
    : new Set([
      ...timeByEmployee.keys(),
      ...leaveByEmployee.keys(),
      ...overtimeByEmployee.keys(),
    ]);
  return Array.from(employeeIds).map((employeeId) => ({
    employee: employeeById.get(employeeId) || { id: employeeId, name: 'Unknown' },
    data: aggregateEmployeeSummary(
      employeeId,
      month,
      year,
      timeByEmployee.get(employeeId) || [],
      leaveByEmployee.get(employeeId) || [],
      overtimeByEmployee.get(employeeId) || [],
    ),
  }));
};

/* Overview tab: one fast path for all employees (demo + production) */
export const getOverviewEmployeeSummaries = async (month, year, employees = []) => {
  if (isDemoMode()) {
    return {
      success: true,
      data: buildDemoOverviewSummaries(month, year, employees),
    };
  }

  try {
    // Computed from time_entries rather than read from time_tracking_summary.
    // That table's overtime columns are filled from overtime_logs alone, but the
    // app records overtime as time_entries rows (hour_type weekend/overtime/
    // bonus/holiday), so its overtime_hours reads 0 for practically every row.
    // getTimeTrackingSummary already made this same call for the single-employee
    // Summary tab; doing it here keeps the two tabs agreeing on one employee.
    const calculated = await calculateAllSummariesFromRawData(month, year, employees);
    return { success: true, data: calculated };
  } catch (error) {
    console.error('Error calculating overview summaries from time entries:', error);

    return { success: false, error: error.message, data: [] };
  }
};

/* Get summaries for all employees in a period */
export const getAllEmployeesSummary = async (month, year) => {
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

  try {
    const { data, error } = await supabase
      .from('time_tracking_summary')
      .select(`
        *,
        employee:employees!time_tracking_summary_employee_id_fkey(id, name, department, position)
      `)
      .eq('month', month)
      .eq('year', year)
      .order('employee_id');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching all employees summary:', error);
    return { success: false, error: error.message };
  }
};

export const getMonthlyAttendanceSummary = async (filters = {}) => {
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

  try {
    let query = supabase
      .from('monthly_attendance_summary')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (filters.year) {
      query = query.eq('year', filters.year);
    }
    if (filters.month) {
      query = query.eq('month', filters.month);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching monthly attendance summary:', error);
    return { success: false, error: error.message };
  }
};

/* Calculate totals for different hour types */
export const calculateHourTotals = async (employeeId, period = 'week') => {
  try {
    const range = attendancePeriodRange(period);
    const [entries, leave, logs] = await Promise.all([
      getTimeEntries(employeeId, range),
      getLeaveRequests(employeeId, { rangeStart: range.startDate, rangeEnd: range.endDate }),
      getOvertimeLogs(employeeId, range),
    ]);
    const failed = [entries, leave, logs].find((result) => !result.success);
    if (failed) return failed;
    const totals = summarizeAttendance({
      timeEntries: entries.data, leaveRequests: leave.data, overtimeLogs: logs.data,
      ...range, employeeId,
    });
    return { success: true, data: { regular: 0, wfh: 0, overtime: 0, holiday: 0, weekend: 0, bonus: 0, ...totals.hours_by_type, total: totals.total_hours } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/* Get pending approvals count (for managers/HR) */
export const getPendingApprovalsCount = async () => {
  if (isDemoMode()) {
    const { getDemoPendingApprovalsCount } = await import('../utils/demoHelper');
    const timeEntries = getDemoPendingApprovalsCount();
    return {
      success: true,
      data: { timeEntries, leaveRequests: 0, overtimeLogs: 0, total: timeEntries }
    };
  }

  try {
    const { isEmployeeActive } = await import('../utils/employeeStatus.js');

    const [timeEntriesResult, leaveRequests, overtimeLogs] = await Promise.all([
      supabase
        .from('time_entries')
        .select(`
          id,
          employee:employees!time_entries_employee_id_fkey(id, status)
        `)
        .eq('status', 'pending'),
      supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('overtime_logs').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);

    if (timeEntriesResult.error) {
      console.error('Error fetching time_entries:', timeEntriesResult.error);
    }
    if (leaveRequests.error) {
      console.error('Error fetching leave_requests:', leaveRequests.error);
    }
    if (overtimeLogs.error) {
      console.error('Error fetching overtime_logs:', overtimeLogs.error);
    }

    const timeEntriesCount = (timeEntriesResult.data || []).filter((entry) =>
      isEmployeeActive(entry.employee)
    ).length;

    return {
      success: true,
      data: {
        timeEntries: timeEntriesCount,
        leaveRequests: leaveRequests.count || 0,
        overtimeLogs: overtimeLogs.count || 0,
        total: timeEntriesCount + (leaveRequests.count || 0) + (overtimeLogs.count || 0)
      }
    };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { success: false, error: error.message, data: { timeEntries: 0, leaveRequests: 0, overtimeLogs: 0, total: 0 } };
  }
};

/* Get detailed pending approvals (for managers/HR) */
export const getPendingApprovals = async () => {
  if (isDemoMode()) {
    const { getDemoTimeEntries, MOCK_EMPLOYEES } = await import('../utils/demoHelper');
    const { isEmployeeActive } = await import('../utils/employeeStatus.js');
    const employeesById = new Map(MOCK_EMPLOYEES.map((emp) => [String(emp.id), emp]));
    const data = getDemoTimeEntries().filter((entry) => {
      if (entry.status !== 'pending') return false;
      const employee =
        entry.employee ||
        employeesById.get(String(entry.employee_id)) ||
        employeesById.get(String(entry.employeeId));
      return isEmployeeActive(employee);
    });
    return { success: true, data };
  }

  try {
    if (import.meta.env.DEV) console.log('🔧 [Service] getPendingApprovals called');
    
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        employee:employees!time_entries_employee_id_fkey(id, name, department, position, status)
      `)
      .eq('status', 'pending')
      .order('date', { ascending: false });

    if (error) {
      console.error('🔧 [Service] Error in getPendingApprovals query:', error);
      throw error;
    }

    const { isEmployeeActive } = await import('../utils/employeeStatus.js');
    const filtered = (data || []).filter((entry) => isEmployeeActive(entry.employee));
    
    if (import.meta.env.DEV) console.log('🔧 [Service] Pending approvals fetched:', filtered.length);
    return { success: true, data: filtered };
  } catch (error) {
    console.error('🔧 [Service] Error fetching pending approvals:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const ensureEmployeeExists = async (employeeId, employeeData = {}) => {
  // In demo mode, always return success - demo users can create entries
  if (isDemoMode()) {
    const emp = getDemoEmployeeById(employeeId);
    if (emp) {
      return { success: true, data: emp, created: false };
    }
    // For demo mode, return a fake employee if not found
    return { 
      success: true, 
      data: { 
        id: employeeId, 
        name: employeeData.name || 'Demo User', 
        email: employeeData.email || 'demo@example.com' 
      }, 
      created: false 
    };
  }
  
  try {
    const id = toEmployeeId(employeeId);
    
    // Check if employee exists by ID first
    const { data: existingById, error: checkError } = await supabase
      .from('employees')
      .select('id, name, email')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking employee by ID:', checkError);
      throw checkError;
    }

    // If employee exists by ID, return it
    if (existingById) {
      return { success: true, data: existingById, created: false };
    }

    // If employee doesn't exist and we have data, check email then create/upsert
    if (employeeData.email || employeeData.name) {
      let email = employeeData.email || `user${id}@company.com`;
      
      // Check if employee with this email already exists
      const { data: existingByEmail, error: emailCheckError } = await supabase
        .from('employees')
        .select('id, name, email')
        .eq('email', email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking employee by email:', emailCheckError);
        throw emailCheckError;
      }

      // If email exists but different ID, generate a unique email instead of failing
      if (existingByEmail && existingByEmail.id !== id) {
        console.warn(`Email ${email} is already used by employee ${existingByEmail.id}. Generating unique email for employee ${id}.`);
        // Generate a unique email by appending the employee ID
        email = employeeData.email 
          ? `${employeeData.email.split('@')[0]}_${id}@${employeeData.email.split('@')[1]}`
          : `user${id}@company.com`;
      }

      // Use upsert to handle race conditions and duplicates
      const { data: newEmployee, error: createError } = await supabase
        .from('employees')
        .upsert([{
          id: id,
          name: employeeData.name || 'Unknown User',
          email: email,
          position: employeeData.position || 'Employee',
          department: employeeData.department || 'General',
          status: 'Active',
          start_date: new Date().toISOString().split('T')[0]
        }], {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (createError) {
        // Handle specific error codes
        if (createError.code === '23505') {
          // Duplicate key error - fetch the existing employee
          const { data: existing } = await supabase
            .from('employees')
            .select('id, name, email')
            .eq('id', id)
            .maybeSingle();
          
          if (existing) {
            return { success: true, data: existing, created: false };
          }
        }
        console.error('Error creating employee:', createError);
        throw createError;
      }

      return { success: true, data: newEmployee, created: true };
    }

    // Employee doesn't exist and no data provided
    return { 
      success: false, 
      error: `Employee with ID ${id} not found. Please contact HR to register.` 
    };
  } catch (error) {
    console.error('Error in ensureEmployeeExists:', error);
    return { success: false, error: error.message };
  }
};

/* Get or create employee from auth user */
export const getOrCreateEmployeeFromAuth = async (authUser) => {
  try {
    if (!authUser || !authUser.id) {
      throw new Error('Invalid auth user');
    }

    const result = await ensureEmployeeExists(authUser.id, {
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      email: authUser.email,
      position: authUser.user_metadata?.position || 'Employee',
      department: authUser.user_metadata?.department || 'General'
    });

    return result;
  } catch (error) {
    console.error('Error getting/creating employee from auth:', error);
    return { success: false, error: error.message };
  }
};

/* Sync local employees to Supabase */
export const syncEmployeesToSupabase = async (employees) => {
  try {
    const employeesData = employees.map(emp => ({
      id: toEmployeeId(emp.id),
      name: emp.name,
      position: emp.position,
      department: emp.department,
      email: emp.email,
      dob: emp.dob,
      address: emp.address,
      phone: emp.phone,
      start_date: emp.startDate,
      status: emp.status,
      performance: emp.performance,
      photo: emp.photo
    }));

    const { data, error } = await supabase
      .from('employees')
      .upsert(employeesData, { onConflict: 'email' })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error syncing employees:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all employees from Supabase
 */
export const getAllEmployees = async () => {
  if (isDemoMode()) {
    // Return all demo employees from demoHelper
    const { getDemoEmployees } = await import('../utils/demoHelper');
    return { success: true, data: getDemoEmployees() };
  }

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employees:', error);
    return { success: false, error: error.message };
  }
};

/* Get employee by ID */
export const getEmployeeById = async (employeeId) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', toEmployeeId(employeeId))
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employee:', error);
    return { success: false, error: error.message };
  }
};

export const getWorkDaysForMonth = async (month, employeeId = null) => {
  try {
    const range = getMonthDateRange(month.getMonth() + 1, month.getFullYear());
    const [entries, leave, overtime] = await Promise.all([
      getAllTimeEntriesDetailed({ ...range, employeeId }),
      getAllLeaveRequests({ ...range, employeeId, includeEmployeeDetails: false }),
      getOvertimeLogs(employeeId, range),
    ]);
    for (const result of [entries, leave, overtime]) if (!result.success) throw new Error(result.error);
    const employees = new Map((entries.data || []).map(entry => [entry.employee_id, entry.employees || entry.employee || { id: entry.employee_id, name: entry.employee_name, department: entry.employee_department }]));
    return [...employees].map(([id, employee]) => {
      const totals = summarizeAttendance({ timeEntries: entries.data, leaveRequests: leave.data, overtimeLogs: overtime.data, employeeId: id, ...range });
      const workDates = new Set((entries.data || []).filter(entry =>
        String(entry.employee_id) === String(id)
        && summarizeAttendance({ timeEntries: [entry], leaveRequests: leave.data, employeeId: id, ...range }).days_worked > 0
      ).map(entry => dateKey(entry.date)));
      return { id, name: employee.name, department: employee.department, workDates,
        totalDays: totals.days_worked, totalOvertime: totals.overtime_hours + totals.holiday_overtime_hours };
    });
  } catch (error) {
    console.error('Error fetching work days for month:', error);
    return [];
  }
};

export default {
  // Time Entries
  createTimeEntry,
  getTimeEntries,
  getAllTimeEntriesDetailed,
  updateTimeEntry,
  updateTimeEntryStatus,
  updateTimeEntryProof,
  deleteTimeEntry,
  uploadProofFile,
  getProofFileSignedUrl,
  deleteProofFile,
  
  // Leave Requests
  createLeaveRequest,
  getLeaveRequests,
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  updateLeaveRequest,
  revertLeaveApproval,
  restoreStandardHoursForLeave,
  
  // Overtime Logs
  createOvertimeLog,
  getOvertimeLogs,
  updateOvertimeStatus,
  
  // Summary & Analytics
  getTimeTrackingSummary,
  updateSummary,
  getAllEmployeesSummary,
  getOverviewEmployeeSummaries,
  getMonthlyAttendanceSummary,
  calculateHourTotals,
  getPendingApprovalsCount,
  getPendingApprovals,
  
  // Employee Management
  ensureEmployeeExists,
  getOrCreateEmployeeFromAuth,
  syncEmployeesToSupabase,
  getAllEmployees,
  getEmployeeById,
  getWorkDaysForMonth
};
