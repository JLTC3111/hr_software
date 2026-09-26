/**
 * Attendance rules — the one definition of how time entries, leave requests
 * and overtime logs roll up into the monthly figures shown on the dashboard,
 * Time Tracking, Organization Overview, the directory, reports and exports.
 *
 * The database mirrors this in public.update_time_tracking_summary. Change
 * both together.
 *
 *  - An approved-leave weekday is a Monday–Friday date inside a leave request
 *    with status 'approved' (start_date..end_date inclusive). No public-holiday
 *    calendar is applied; overlapping approved requests count a date once.
 *  - On such a date the employee is on leave: it counts once as a leave day,
 *    regular and work-from-home hours entered on it do not count, it is not a
 *    worked day, and overtime / weekend / bonus / holiday hours still count.
 *  - Pending and rejected leave never suppresses attendance or counts as leave.
 *  - A leave-type time entry (on_leave, vacation, sick_leave) marks its date as
 *    leave once approved. It is never a worked day and its hours never count.
 *    It does not suppress hours filed on the same date; only an approved leave
 *    request does that.
 *  - Time entries and overtime logs count while pending or approved.
 *
 * Dates are calendar dates ('YYYY-MM-DD'). They are never turned into a Date to
 * decide which month they belong to — `new Date('2026-10-01')` is UTC midnight,
 * which is still 30 September west of Greenwich.
 */

/** Calendar keys stay local when choosing a report period. */
export const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const attendancePeriodRange = (period, now = new Date()) => {
  const start = period === 'week'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = period === 'week'
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
};

/** Local YYYY-MM-DD keys for Mon–Fri in an inclusive range. */
export const workingDateKeys = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const keys = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) keys.push(localDateKey(cursor));
  }
  return keys;
};

export const LEAVE_ENTRY_TYPES = Object.freeze(['on_leave', 'vacation', 'sick_leave']);
export const PREMIUM_HOUR_TYPES = Object.freeze(['overtime', 'weekend', 'bonus', 'holiday']);
export const STANDARD_WORKING_DAYS_PER_MONTH = 22;

const LEAVE_ENTRY_TYPE_SET = new Set(LEAVE_ENTRY_TYPES);
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})/;

/** 'YYYY-MM-DD' from a SQL date or an ISO timestamp string. */
export const dateKey = (value) => (value == null ? '' : String(value).slice(0, 10));

/** Calendar parts of a 'YYYY-MM-DD' string, read directly — no Date, no timezone. */
export const dateKeyParts = (value) => {
  const match = DATE_KEY.exec(String(value ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

export const isDateKeyInMonth = (value, month, year) => {
  const parts = dateKeyParts(value);
  return parts !== null && parts.month === Number(month) && parts.year === Number(year);
};

export const isApprovedStatus = (status) => String(status ?? '').toLowerCase() === 'approved';

/** Entries and logs count while pending or approved; an omitted status uses the insert default, pending; explicit NULL is uncounted. */
const isCountedStatus = (status) => {
  if (status === undefined) return true;
  const normalized = String(status).toLowerCase();
  return normalized === 'pending' || normalized === 'approved';
};

const roundHours = (value) => Math.round(value * 100) / 100;

const clip = (start, end, startDate, endDate) => ({
  from: startDate && start < startDate ? startDate : start,
  to: endDate && end > endDate ? endDate : end,
});

/**
 * Distinct approved-leave weekdays, clipped to [startDate, endDate] when given.
 * A request from 30 Sep to 2 Oct yields one September key and two October keys.
 */
export const approvedLeaveDateKeys = (leaveRequests, startDate = null, endDate = null, employeeId = null) => {
  const keys = new Set();
  for (const request of leaveRequests || []) {
    if (!isApprovedStatus(request?.status)) continue;
    if (employeeId != null && String(request.employee_id) !== String(employeeId)) continue;
    const start = dateKey(request.start_date);
    const end = dateKey(request.end_date) || start;
    if (!dateKeyParts(start) || !dateKeyParts(end)) continue;
    const { from, to } = clip(start, end, startDate, endDate);
    if (from > to) continue;
    for (const key of workingDateKeys(from, to)) keys.add(key);
  }
  return keys;
};

/** Same as approvedLeaveDateKeys, grouped as Map<employeeId, Set<dateKey>>. */
export const approvedLeaveDateKeysByEmployee = (leaveRequests, startDate = null, endDate = null) => {
  const byEmployee = new Map();
  for (const request of leaveRequests || []) {
    if (!isApprovedStatus(request?.status) || request?.employee_id == null) continue;
    const keys = approvedLeaveDateKeys([request], startDate, endDate);
    if (!keys.size) continue;
    const id = String(request.employee_id);
    const existing = byEmployee.get(id);
    if (existing) keys.forEach((key) => existing.add(key));
    else byEmployee.set(id, keys);
  }
  return byEmployee;
};

export const emptyAttendanceTotals = () => ({
  days_worked: 0,
  leave_days: 0,
  regular_hours: 0,
  office_hours: 0,
  wfh_hours: 0,
  overtime_hours: 0,
  holiday_overtime_hours: 0,
  total_hours: 0,
  attendance_rate: 0,
  hours_by_type: {},
});

// Service totals also include overtime logs. A loaded summary remains
// authoritative even when every numeric value is zero; entries are a fallback
// only while no service summary exists.
export const selectAttendanceTotals = (summary, entries) => ({
  ...emptyAttendanceTotals(),
  ...(summary ?? entries),
});

/**
 * Canonical totals for an employee or cohort over a period. Date sets are
 * keyed by employee as well as date: one person's leave cannot erase another
 * person's hours, and two people working the same day are two person-days.
 *
 * `regular_hours` is regular + WFH (the summary-table column); `office_hours`
 * and `wfh_hours` split it for reports. `overtime_hours` is overtime + weekend
 * + bonus entries plus non-holiday overtime logs; `holiday_overtime_hours` is
 * holiday entries plus holiday overtime logs. `total_hours` is everything that
 * counted. `attendance_rate` is (worked + leave) / 22, capped at 100.
 */
export const summarizeAttendance = ({
  timeEntries = [],
  leaveRequests = [],
  overtimeLogs = [],
  startDate = null,
  endDate = null,
  employeeId = null,
} = {}) => {
  const inRange = (key) => Boolean(key) && (!startDate || key >= startDate) && (!endDate || key <= endDate);
  const forEmployee = (row) => employeeId == null || String(row?.employee_id) === String(employeeId);

  const coveredDates = approvedLeaveDateKeysByEmployee((leaveRequests || []).filter(forEmployee), startDate, endDate);
  const personDate = (id, date) => `${id}\u0000${date}`;
  const leaveDates = new Set();
  coveredDates.forEach((dates, id) => dates.forEach((date) => leaveDates.add(personDate(id, date))));
  const workedDates = new Set();
  let office = 0;
  let wfh = 0;
  let overtime = 0;
  let weekend = 0;
  let bonus = 0;
  let holiday = 0;
  const hoursByType = {};

  for (const entry of timeEntries || []) {
    if (!entry || !forEmployee(entry)) continue;
    const date = dateKey(entry.date);
    const id = String(entry.employee_id ?? employeeId ?? '');
    if (!inRange(date) || !isCountedStatus(entry.status)) continue;
    const type = String(entry.hour_type || entry.hourType || 'regular').toLowerCase();
    if (LEAVE_ENTRY_TYPE_SET.has(type)) {
      if (isApprovedStatus(entry.status)) leaveDates.add(personDate(id, date));
      continue;
    }
    const hours = roundHours(Number(entry.hours) || 0);
    const covered = coveredDates.get(id)?.has(date) ?? false;
    const countedHours = covered && !PREMIUM_HOUR_TYPES.includes(type) ? 0 : hours;
    hoursByType[type] = (hoursByType[type] ?? 0) + countedHours;
    switch (type) {
      case 'overtime': overtime += hours; break;
      case 'weekend': weekend += hours; break;
      case 'bonus': bonus += hours; break;
      case 'holiday': holiday += hours; break;
      case 'wfh': if (!covered) wfh += hours; break;
      default: if (!covered) office += hours; // 'regular' and anything unrecognised
    }
    if (!covered) workedDates.add(personDate(id, date));
  }

  let logOvertime = 0;
  let logHoliday = 0;
  for (const log of overtimeLogs || []) {
    if (!log || !forEmployee(log)) continue;
    const date = dateKey(log.date);
    if (!inRange(date) || !isCountedStatus(log.status)) continue;
    const hours = roundHours(Number(log.hours) || 0);
    if (String(log.overtime_type || '').toLowerCase() === 'holiday') logHoliday += hours;
    else logOvertime += hours;
  }
  if (logOvertime) hoursByType.overtime = (hoursByType.overtime ?? 0) + logOvertime;
  if (logHoliday) hoursByType.holiday = (hoursByType.holiday ?? 0) + logHoliday;

  const daysWorked = workedDates.size;
  const leaveDays = leaveDates.size;
  const attendance = Math.min(((daysWorked + leaveDays) / STANDARD_WORKING_DAYS_PER_MONTH) * 100, 100);

  return {
    days_worked: daysWorked,
    leave_days: leaveDays,
    regular_hours: roundHours(office + wfh),
    office_hours: roundHours(office),
    wfh_hours: roundHours(wfh),
    overtime_hours: roundHours(overtime + weekend + bonus + logOvertime),
    holiday_overtime_hours: roundHours(holiday + logHoliday),
    total_hours: roundHours(office + wfh + overtime + weekend + bonus + holiday + logOvertime + logHoliday),
    attendance_rate: roundHours(attendance),
    hours_by_type: Object.fromEntries(Object.entries(hoursByType).map(([type, hours]) => [type, roundHours(hours)])),
  };
};
