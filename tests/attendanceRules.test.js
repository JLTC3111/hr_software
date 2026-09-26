import test from 'node:test';
import process from 'node:process';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  approvedLeaveDateKeys,
  approvedLeaveDateKeysByEmployee,
  attendancePeriodRange,
  localDateKey,
  selectAttendanceTotals,
  summarizeAttendance,
} from '../src/utils/attendanceRules.js';

test('cohort totals keep each employee separate on the same calendar date', () => {
  const totals = summarizeAttendance({
    timeEntries: ['a', 'b', 'c'].map(employee_id => ({ employee_id, date: '2026-10-01', hours: 8, hour_type: 'regular', status: 'approved' })),
    leaveRequests: [{ employee_id: 'a', start_date: '2026-10-01', end_date: '2026-10-01', status: 'approved' }],
  });
  assert.equal(totals.total_hours, 16);
  assert.equal(totals.days_worked, 2);
  assert.equal(totals.leave_days, 1);
});

test('standalone leave shares the request date set without suppressing regular attendance', () => {
  const totals = summarizeAttendance({
    timeEntries: [
      { employee_id: 'a', date: '2026-10-01', hours: 8, hour_type: 'on_leave', status: 'approved' },
      { employee_id: 'a', date: '2026-10-01', hours: 8, hour_type: 'vacation', status: 'approved' },
      { employee_id: 'a', date: '2026-10-02', hours: 8, hour_type: 'sick_leave', status: 'approved' },
      { employee_id: 'a', date: '2026-10-02', hours: 8, hour_type: 'regular', status: 'approved' },
      { employee_id: 'a', date: '2026-10-03', hours: 8, hour_type: 'on_leave', status: 'pending' },
      { employee_id: 'a', date: '2026-10-04', hours: 8, hour_type: 'regular', status: null },
    ],
    leaveRequests: [{ employee_id: 'a', start_date: '2026-10-01', end_date: '2026-10-01', status: 'approved' }],
  });
  assert.equal(totals.leave_days, 2);
  assert.equal(totals.total_hours, 8);
  assert.equal(totals.days_worked, 1);
});

test('weekly range crossing September and October uses calendar keys', () => {
  assert.equal(localDateKey(new Date(2026, 9, 1)), '2026-10-01');
  assert.deepEqual(attendancePeriodRange('week', new Date(2026, 9, 1)), { startDate: '2026-09-27', endDate: '2026-10-03' });
  assert.deepEqual(attendancePeriodRange('month', new Date(2026, 9, 1)), { startDate: '2026-10-01', endDate: '2026-10-31' });
});

test('Time Tracking selection preserves zero worked days and complete service overtime logs', () => {
  const computed = summarizeAttendance({
    timeEntries: [{ employee_id: 'a', date: '2026-10-01', hours: 8, hour_type: 'regular', status: 'approved' }],
    leaveRequests: [{ employee_id: 'a', start_date: '2026-10-01', end_date: '2026-10-01', status: 'approved' }],
    overtimeLogs: [{ employee_id: 'a', date: '2026-10-01', hours: 2, overtime_type: 'regular', status: 'approved' }],
  });
  const selected = selectAttendanceTotals(computed, { days_worked: 22, total_hours: 176, overtime_hours: 0 });
  assert.equal(selected.days_worked, 0);
  assert.equal(selected.regular_hours, 0);
  assert.equal(selected.total_hours, 2);
  assert.equal(selected.overtime_hours, 2);
  assert.equal(selectAttendanceTotals(null, computed).days_worked, 0);
});

test('calendar dates are read as written, never through Date, in every timezone', () => {
  for (const timezone of ['America/Los_Angeles', 'UTC', 'Asia/Ho_Chi_Minh']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { isDateKeyInMonth, approvedLeaveDateKeys, dateKeyParts } from './src/utils/attendanceRules.js';
      const leave = [{ employee_id: 'e', start_date: '2026-09-30', end_date: '2026-10-02', status: 'approved' }];
      console.log(JSON.stringify({
        october: isDateKeyInMonth('2026-10-01', 10, 2026),
        september: isDateKeyInMonth('2026-10-01', 9, 2026),
        timestamp: dateKeyParts('2026-10-01T00:00:00+00:00'),
        naive: new Date('2026-10-01').getMonth() + 1,
        sep: [...approvedLeaveDateKeys(leave, '2026-09-01', '2026-09-30')],
        oct: [...approvedLeaveDateKeys(leave, '2026-10-01', '2026-10-31')],
      }));
    `], { encoding: 'utf8', env: { ...process.env, TZ: timezone } });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.october, true, timezone);
    assert.equal(parsed.september, false, timezone);
    assert.deepEqual(parsed.timestamp, { year: 2026, month: 10, day: 1 });
    assert.deepEqual(parsed.sep, ['2026-09-30'], timezone);
    assert.deepEqual(parsed.oct, ['2026-10-01', '2026-10-02'], timezone);
    if (timezone === 'America/Los_Angeles') {
      // The pitfall this guards against: new Date('YYYY-MM-DD') is UTC midnight,
      // still 30 September in Los Angeles.
      assert.equal(parsed.naive, 9);
    }
  }
});

test('approved leave weekdays are distinct, clipped and Monday–Friday only', () => {
  const leave = [
    { employee_id: 'e', start_date: '2026-09-10', end_date: '2026-09-12', status: 'approved' },
    { employee_id: 'e', start_date: '2026-09-11', end_date: '2026-09-15', status: 'approved' },
    { employee_id: 'e', start_date: '2026-09-16', end_date: '2026-09-16', status: 'pending' },
    { employee_id: 'e', start_date: '2026-09-17', end_date: '2026-09-17', status: 'rejected' },
    { employee_id: 'other', start_date: '2026-09-14', end_date: '2026-09-14', status: 'approved' },
  ];
  assert.deepEqual([...approvedLeaveDateKeys(leave, null, null, 'e')], ['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']);
  assert.deepEqual([...approvedLeaveDateKeys(leave, '2026-09-14', '2026-09-30', 'e')], ['2026-09-14', '2026-09-15']);
  const byEmployee = approvedLeaveDateKeysByEmployee(leave);
  assert.equal(byEmployee.get('e').size, 4);
  assert.deepEqual([...byEmployee.get('other')], ['2026-09-14']);
  assert.equal(approvedLeaveDateKeys([{ employee_id: 'e', start_date: '2026-09-05', end_date: '2026-09-06', status: 'approved' }]).size, 0);
  assert.equal(approvedLeaveDateKeys([{ employee_id: 'e', start_date: '2026-09-10', status: 'approved' }]).size, 1, 'missing end_date means a single day');
});

test('summary: leave day with overtime is one leave day, zero worked days, overtime kept, regular and WFH dropped', () => {
  const totals = summarizeAttendance({
    timeEntries: [
      { employee_id: 'e', date: '2026-09-01', hours: 8, hour_type: 'regular', status: 'approved' },
      { employee_id: 'e', date: '2026-09-01', hours: 4, hour_type: 'wfh', status: 'approved' },
      { employee_id: 'e', date: '2026-09-01', hours: 2, hour_type: 'overtime', status: 'pending' },
      { employee_id: 'e', date: '2026-09-02', hours: 8, hour_type: 'regular', status: 'approved' },
      { employee_id: 'e', date: '2026-09-03', hours: 8, hour_type: 'regular', status: 'rejected' },
    ],
    leaveRequests: [{ employee_id: 'e', start_date: '2026-09-01', end_date: '2026-09-01', status: 'approved' }],
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  });
  assert.equal(totals.leave_days, 1);
  assert.equal(totals.days_worked, 1);
  assert.equal(totals.regular_hours, 8);
  assert.equal(totals.office_hours, 8);
  assert.equal(totals.wfh_hours, 0);
  assert.equal(totals.overtime_hours, 2);
  assert.equal(totals.total_hours, 10);
});

test('summary: pending leave does not suppress hours; a fully covered period has no worked days', () => {
  const entries = [
    { employee_id: 'e', date: '2026-09-01', hours: 8, hour_type: 'regular', status: 'approved' },
    { employee_id: 'e', date: '2026-09-02', hours: 8, hour_type: 'regular', status: 'approved' },
  ];
  const pending = summarizeAttendance({
    timeEntries: entries,
    leaveRequests: [{ employee_id: 'e', start_date: '2026-09-01', end_date: '2026-09-02', status: 'pending' }],
    startDate: '2026-09-01', endDate: '2026-09-30',
  });
  assert.equal(pending.days_worked, 2);
  assert.equal(pending.leave_days, 0);
  assert.equal(pending.regular_hours, 16);

  const covered = summarizeAttendance({
    timeEntries: entries,
    leaveRequests: [{ employee_id: 'e', start_date: '2026-09-01', end_date: '2026-09-30', status: 'approved' }],
    startDate: '2026-09-01', endDate: '2026-09-30',
  });
  assert.equal(covered.days_worked, 0);
  assert.equal(covered.leave_days, 22);
  assert.equal(covered.total_hours, 0);
  assert.equal(covered.attendance_rate, 100);
});

test('summary: leave-type entries count as leave only once approved and never as hours', () => {
  const totals = summarizeAttendance({
    timeEntries: [
      { employee_id: 'e', date: '2026-09-01', hours: 8, hour_type: 'on_leave', status: 'approved' },
      { employee_id: 'e', date: '2026-09-02', hours: 8, hour_type: 'sick_leave', status: 'pending' },
      { employee_id: 'e', date: '2026-09-03', hours: 8, hour_type: 'regular', status: 'approved' },
    ],
    startDate: '2026-09-01', endDate: '2026-09-30',
  });
  assert.equal(totals.leave_days, 1);
  assert.equal(totals.days_worked, 1);
  assert.equal(totals.total_hours, 8);
});

test('summary: cross-month leave is clipped to the period and other employees are ignored', () => {
  const leave = [
    { employee_id: 'e', start_date: '2026-09-30', end_date: '2026-10-02', status: 'approved' },
    { employee_id: 'other', start_date: '2026-09-01', end_date: '2026-09-04', status: 'approved' },
  ];
  const entries = [
    { employee_id: 'e', date: '2026-09-30', hours: 8, hour_type: 'regular', status: 'approved' },
    { employee_id: 'e', date: '2026-10-01', hours: 8, hour_type: 'regular', status: 'approved' },
    { employee_id: 'other', date: '2026-09-01', hours: 8, hour_type: 'regular', status: 'approved' },
  ];
  const september = summarizeAttendance({ timeEntries: entries, leaveRequests: leave, startDate: '2026-09-01', endDate: '2026-09-30', employeeId: 'e' });
  const october = summarizeAttendance({ timeEntries: entries, leaveRequests: leave, startDate: '2026-10-01', endDate: '2026-10-31', employeeId: 'e' });
  assert.equal(september.leave_days, 1);
  assert.equal(september.regular_hours, 0);
  assert.equal(october.leave_days, 2);
  assert.equal(october.regular_hours, 0);
});

test('summary: overtime logs add to overtime, holiday logs to holiday overtime', () => {
  const totals = summarizeAttendance({
    timeEntries: [{ employee_id: 'e', date: '2026-09-05', hours: 4, hour_type: 'weekend', status: 'approved' }],
    overtimeLogs: [
      { employee_id: 'e', date: '2026-09-07', hours: 2, overtime_type: 'regular', status: 'approved' },
      { employee_id: 'e', date: '2026-09-08', hours: 3, overtime_type: 'holiday', status: 'pending' },
      { employee_id: 'e', date: '2026-09-09', hours: 5, overtime_type: 'regular', status: 'rejected' },
    ],
    startDate: '2026-09-01', endDate: '2026-09-30',
  });
  assert.equal(totals.overtime_hours, 6);
  assert.equal(totals.holiday_overtime_hours, 3);
  assert.equal(totals.total_hours, 9);
  assert.equal(totals.days_worked, 1);
});
