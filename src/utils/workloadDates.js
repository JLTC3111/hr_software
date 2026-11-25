import { localeTag } from './localeFormat.js';

export const WORKLOAD_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const vietnamCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORKLOAD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export const isCalendarDay = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Keep SQL dates as calendar days. Convert timestamp instants using Vietnam time. */
export const vietnamCalendarDay = (value = new Date()) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return isCalendarDay(value) ? value : null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(vietnamCalendar.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Compare calendar days independently of the user's operating-system time zone. */
export const calendarDayDistance = (from, to) => (
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
);

export const formatWorkloadDay = (value, language, options) => {
  const day = value == null ? null : vietnamCalendarDay(value);
  return day ? new Intl.DateTimeFormat(localeTag(language), { ...options, timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`)) : '';
};

export const formatWorkloadTimestamp = (value, language, options) => {
  if (!value || isCalendarDay(value)) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(localeTag(language), { ...options, timeZone: WORKLOAD_TIME_ZONE }).format(date)
    : '';
};

export const workloadStatus = (task) => String(task?.status ?? '').toLowerCase().replace(/_/g, '-');

export const isOpenWorkloadTask = (task) => !['completed', 'cancelled'].includes(workloadStatus(task));

export const taskCompletionIssue = (task, today = vietnamCalendarDay()) => {
  if (workloadStatus(task) !== 'completed') return null;
  const completion = task.completion_date;
  if (!completion) return 'missing';
  if (!isCalendarDay(completion) || (isCalendarDay(task.start_date) && completion < task.start_date)) return 'invalid';
  return completion > today ? 'future' : null;
};

export const taskReportDay = (task, today = vietnamCalendarDay()) => {
  if (workloadStatus(task) === 'completed') return taskCompletionIssue(task, today) ? null : task.completion_date;
  return [task?.due_date, task?.start_date, task?.created_at].filter(Boolean)
    .map(vietnamCalendarDay).find(Boolean) || null;
};

export const selectReportTasks = (rows, { startDate, endDate, today = vietnamCalendarDay() }) => {
  const tasks = [];
  const taskDateIssues = [];
  for (const task of rows) {
    const issue = taskCompletionIssue(task, today);
    if (issue) {
      const completionDay = isCalendarDay(task.completion_date) ? task.completion_date : null;
      const couldBelong = completionDay ? completionDay >= startDate && completionDay <= endDate
        : !isCalendarDay(task.start_date) || task.start_date <= endDate;
      if (couldBelong) taskDateIssues.push({ task, issue });
      continue;
    }
    const day = taskReportDay(task, today);
    if (day && day >= startDate && day <= endDate) tasks.push(task);
  }
  return { tasks, taskDateIssues };
};
