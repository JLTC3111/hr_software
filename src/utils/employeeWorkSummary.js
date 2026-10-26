import { LEAVE_ENTRY_TYPES, summarizeAttendance } from './attendanceRules.js';

// Keep the summary, report preview and exports on the same calendar dates.
export const reportRecordDate = (item) =>
  String(item?.date || (item?.status === 'completed' && item?.completion_date) || item?.due_date || item?.target_date || item?.start_date || item?.created_at || '').slice(0, 10);

export const validReportRange = (startDate, endDate) => {
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return validDate(startDate) && validDate(endDate) && startDate <= endDate;
};

const fallbackText = (_key, fallback) => fallback;
const hours = (value) => Number(value || 0).toFixed(1);
const statusKey = (value) => String(value || '').toLowerCase().replace(/[ _]/g, '-');
const countedStatus = (row) => row.status === undefined || ['pending', 'approved'].includes(String(row.status).toLowerCase());

/**
 * A record-based summary: no invented achievements or inferred task progress.
 * The same model feeds the screen and every export, without a model/API call.
 * textForField lets callers supply demo labels or cached UGC translations.
 */
export const buildEmployeeWorkSummary = (employee, data = {}, {
  startDate, endDate, t = fallbackText, employeeName = employee?.name || '',
  scope = { timeEntries: true, tasks: true, goals: true, leave: true },
  textForField = (record, field) => record[field] || '',
} = {}) => {
  if (employee?.id == null || !validReportRange(startDate, endDate)) return null;
  const say = (key, fallback, values = {}) => t(`reports.workSummary.${key}`, fallback)
    .replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
  const belongs = (row) => row && String(row.employee_id) === String(employee.id);
  const inRange = (row) => {
    const date = reportRecordDate(row);
    return date && date >= startDate && date <= endDate;
  };
  const select = (rows) => (rows || []).filter(row => belongs(row) && inRange(row));
  const timeEntries = scope.timeEntries ? select(data.timeEntries) : [];
  const overtimeLogs = scope.timeEntries ? select(data.overtimeLogs) : [];
  const tasks = scope.tasks ? select(data.tasks) : [];
  const goals = scope.goals ? select(data.goals) : [];
  // Approved leave governs hours even if its export section is unticked.
  const leaveRequests = (data.leaveForAttendance || data.leave || []).filter(belongs);
  const leave = scope.leave ? leaveRequests.filter(row => row.start_date <= endDate && (row.end_date || row.start_date) >= startDate) : [];
  const attendance = summarizeAttendance({ timeEntries, overtimeLogs, leaveRequests, employeeId: employee.id, startDate, endDate });
  const completedTasks = tasks.filter(task => statusKey(task.status) === 'completed');
  const otherTasks = tasks.filter(task => statusKey(task.status) !== 'completed');
  const goalProgress = (goal) => statusKey(goal.status) === 'completed'
    ? 100 : Math.max(0, Math.min(100, Number(goal.progress_percentage ?? goal.progress) || 0));
  const avgGoalProgress = goals.length ? goals.reduce((sum, goal) => sum + goalProgress(goal), 0) / goals.length : 0;
  const pendingHours = summarizeAttendance({
    timeEntries: timeEntries.filter(row => String(row.status ?? 'pending').toLowerCase() === 'pending'),
    overtimeLogs: overtimeLogs.filter(row => String(row.status ?? 'pending').toLowerCase() === 'pending'),
    leaveRequests, employeeId: employee.id, startDate, endDate,
  }).total_hours;
  const missingCompletionDates = completedTasks.filter(task => !task.completion_date).length;
  const hasRecords = timeEntries.length + overtimeLogs.length + tasks.length + goals.length + leave.length > 0;
  const overview = [];
  if (hasRecords && scope.timeEntries) overview.push(say('timeSentence',
    '{name} recorded {hours} hours across {days} worked days, including {overtime} overtime hours and {wfh} hours working from home.',
    { name: employeeName, hours: hours(attendance.total_hours), days: attendance.days_worked,
      overtime: hours(attendance.overtime_hours + attendance.holiday_overtime_hours), wfh: hours(attendance.wfh_hours) }));
  if (tasks.length) overview.push(say('taskSentence', 'Completed {completed} of {total} tasks recorded for this period.', { completed: completedTasks.length, total: tasks.length }));
  if (goals.length) overview.push(say('goalSentence', 'Goals tracked: {total}; currently completed: {completed}; current average progress: {progress}%.',
    { total: goals.length, completed: goals.filter(goal => statusKey(goal.status) === 'completed').length, progress: avgGoalProgress.toFixed(1) }));
  if (leave.length) overview.push(say('leaveSentence', 'Approved leave: {days} working days.', { days: attendance.leave_days }));

  const translateStatus = (status) => {
    const keys = { completed: 'statusCompleted', pending: 'statusPending', 'in-progress': 'statusInProgress', 'not-started': 'statusNotStarted', approved: 'statusApproved' };
    const normalized = statusKey(status);
    if (normalized === 'cancelled') return t('personalGoals.cancelled', 'Cancelled');
    return normalized ? t(`reports.${keys[normalized] || normalized}`, status) : '';
  };
  const taskItem = (task, index) => ({
    key: `task-${task.id ?? index}`,
    date: reportRecordDate(task),
    title: textForField(task, 'title', 'task') || t('dataType.task', 'Task'),
    meta: translateStatus(task.status),
    details: [
      textForField(task, 'description', 'task'),
      task.self_assessment && `${t('taskListing.selfAssessment', 'Self Assessment')}: ${textForField(task, 'self_assessment', 'task')}`,
      task.comments && `${t('timeTracking.notes', 'Notes')}: ${textForField(task, 'comments', 'task')}`,
    ].filter(Boolean),
  });
  const sections = [
    { key: 'completed', title: say('completedWork', 'Completed work'), items: completedTasks.map(taskItem) },
    { key: 'other', title: say('otherTasks', 'Other recorded tasks'), items: otherTasks.map(taskItem) },
    { key: 'goals', title: t('reports.goals', 'Goals'), items: goals.map((goal, index) => ({
      key: `goal-${goal.id ?? index}`, date: reportRecordDate(goal),
      title: textForField(goal, 'title', 'goal') || t('dataType.goal', 'Goal'),
      meta: [translateStatus(goal.status), `${goalProgress(goal)}%`].filter(Boolean).join(' · '),
      details: [textForField(goal, 'description', 'goal'), textForField(goal, 'notes', 'goal')].filter(Boolean),
    })) },
  ];

  // Combine repeated notes without dropping any distinct work or its dates.
  const noteGroups = new Map();
  for (const [kind, entries] of [['time', timeEntries], ['overtime', overtimeLogs]]) {
    for (const entry of entries) {
      if (!countedStatus(entry) || (kind === 'time' && LEAVE_ENTRY_TYPES.includes(String(entry.hour_type || '').toLowerCase()))) continue;
      const field = kind === 'time' ? 'notes' : 'reason';
      const text = String(textForField(entry, field, kind) || '').trim();
      if (!text) continue;
      if (!noteGroups.has(text)) noteGroups.set(text, new Set());
      noteGroups.get(text).add(reportRecordDate(entry));
    }
  }
  sections.push({ key: 'notes', title: say('workNotes', 'Recorded work notes'), items: [...noteGroups].map(([text, dates], index) => ({
    key: `note-${index}`, date: [...dates].sort().join(', '), title: '', meta: '', details: [text],
  })) });
  const notes = [];
  if (pendingHours > 0) notes.push(say('pendingHours', '{hours} hours are awaiting approval and are included in the total.', { hours: hours(pendingHours) }));
  if (missingCompletionDates) notes.push(say('missingCompletion', 'Completed tasks without a completion date: {count}. The report uses their due, start or creation date.', { count: missingCompletionDates }));
  if (goals.length) notes.push(say('goalSnapshot', 'Goal statuses and progress reflect the latest records, not a historical snapshot.'));
  if (!hasRecords) overview.push(say('empty', 'No work records were found for this employee in the selected period and record types.'));
  return { employeeId: String(employee.id), employeeName, startDate, endDate, hasRecords, overview, notes,
    sections: sections.filter(section => section.items.length),
    metrics: { totalHours: attendance.total_hours, completedTasks: completedTasks.length, tasks: tasks.length, goals: goals.length } };
};

/** Plain, complete rows shared by copy, CSV, Excel and PDF. */
export const employeeWorkSummaryRows = (summary, t = fallbackText) => summary ? [
  ...summary.overview.map(text => [t('reports.excel.sheets.summary', 'Summary'), text]),
  ...summary.sections.flatMap(section => section.items.map(item => [section.title,
    [item.date, item.title, item.meta, ...item.details].filter(Boolean).join('\n')])),
  ...summary.notes.map(text => [t('timeTracking.notes', 'Notes'), text]),
] : [];

export const employeeWorkSummaryText = (summary, t = fallbackText) => summary ? [
  `${summary.employeeName} — ${t('reports.workSummary.title', 'Work summary')}`,
  `${summary.startDate} → ${summary.endDate}`,
  ...employeeWorkSummaryRows(summary, t).map(([label, text]) => `${label}: ${text}`),
].join('\n\n') : '';
