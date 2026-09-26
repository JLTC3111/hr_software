import test from 'node:test';
import process from 'node:process';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fetchAllRows } from '../src/utils/fetchAllRows.js';
import * as timeHelpers from '../src/utils/timeEntryHelpers.js';
import * as reportHelpers from '../src/utils/reportExportHelpers.js';
import * as attendanceRules from '../src/utils/attendanceRules.js';
import * as documentPaths from '../src/utils/documentPaths.js';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';

const timeService = (client, demo = false) => loadSource('src/services/timeTrackingService.js', {
  '../utils/fetchAllRows.js': { fetchAllRows },
  '../config/supabaseClient': { supabase: client },
  '../utils/demoHelper': {
    isDemoMode: () => demo,
    MOCK_EMPLOYEES: client.tables.employees || [],
    getDemoEmployeeById: id => (client.tables.employees || []).find(row => row.id === id),
    getDemoTimeEntries: () => (client.tables.time_entries || []).map(row => ({ ...row })),
    getDemoLeaveRequests: () => (client.tables.leave_requests || []).map(row => ({ ...row })),
    updateDemoLeaveRequest: (id, updates) => {
      const i = client.tables.leave_requests.findIndex(row => row.id === id);
      client.tables.leave_requests[i] = { ...client.tables.leave_requests[i], ...updates };
      return client.tables.leave_requests[i];
    },
    calculateDaysBetween: reportHelpers.countWorkingDays,
    deleteDemoTimeEntry: id => {
      const i = client.tables.time_entries.findIndex(row => row.id === id);
      if (i >= 0) client.tables.time_entries.splice(i, 1);
    },
    addDemoTimeEntry: row => client.tables.time_entries.push(row),
  },
  '../utils/demoStorage': {},
  '../utils/timeEntryHelpers.js': timeHelpers,
  '../utils/reportExportHelpers.js': reportHelpers,
  '../utils/attendanceRules.js': attendanceRules,
  './documentService.js': {},
});

const BULK_NOTE = 'Standard hours filled by admin: Ada';
const generatedRow = (id, employee_id, date, extra = {}) => ({
  id, employee_id, date, hours: 8, hour_type: 'regular', clock_in: '09:00:00', clock_out: '17:00:00', notes: BULK_NOTE, status: 'approved', ...extra,
});
const rowKeys = (rows) => rows.map((row) => `${row.employee_id}:${row.date}:${String(row.clock_in).slice(0, 5)}:${row.hour_type}`).sort().join(',');
const generatedRows = (rows) => rows.filter((row) => String(row.notes || '').startsWith('Standard hours filled by admin:'));

test('production approval relies on transactional trigger cleanup and never sends a delayed DELETE', async () => {
  const client = queryFixture({ leave_requests: [{ id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-01', status: 'pending' }] }, {}, { persist: true });
  const result = await timeService(client).updateLeaveRequestStatus(1, 'approved', 'manager');
  assert.equal(result.success, true);
  assert.equal(client.tables.leave_requests[0].status, 'approved');
  assert.equal(client.calls.some(call => call.table === 'time_entries' && call.method === 'delete'), false);
  assert.equal(result.generated.removed, null, 'the row response does not claim a deletion count');
});

test('demo approval cleanup enforces every predicate and keeps all near misses', async () => {
  const rows = [
    generatedRow(1, 'employee', '2026-09-01'),
    generatedRow(2, 'employee', '2026-09-02', { notes: 'Manual exact hours' }),
    generatedRow(3, 'employee', '2026-09-03', { clock_in: '09:12:00', clock_out: '17:08:00' }),
    generatedRow(4, 'employee', '2026-09-04', { hour_type: 'wfh' }),
    generatedRow(5, 'employee', '2026-09-05'),
    generatedRow(6, 'employee', '2026-09-07', { hour_type: 'overtime' }),
    generatedRow(7, 'employee', '2026-09-08', { clock_in: '09:00:00.5' }),
    generatedRow(8, 'employee', '2026-09-09', { clock_out: '17:00:01' }),
    generatedRow(9, 'employee', '2026-09-10', { notes: null }),
    generatedRow(10, 'other', '2026-09-01'),
    generatedRow(11, 'employee', '2026-10-01'),
  ];
  const client = queryFixture({ time_entries: rows, leave_requests: [{ id: 1, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-30', status: 'pending' }] }, {}, { persist: true });
  const result = await timeService(client, true).updateLeaveRequestStatus(1, 'approved', 'manager');
  assert.equal(result.generated.removed, 1);
  assert.deepEqual(rows.map(row => row.id), [2,3,4,5,6,7,8,9,10,11]);
});

test('fill reports actual stored rows when the database insert guard skips part of a batch', async () => {
  const client = queryFixture({ employees: [{ id: 'employee', name: 'Employee' }] });
  const from = client.from.bind(client);
  client.from = table => {
    const query = from(table);
    const insert = query.insert;
    query.insert = rows => insert(rows.slice(1)); // emulate INSERT RETURNING after BEFORE guard
    return query;
  };
  const result = await timeService(client).fillStandardHoursForAllEmployees({ startDate: '2026-10-01', endDate: '2026-10-02' });
  assert.equal(result.success, true);
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 1);
});

test('restore skips overlapping WFH or non-regular 09:00 rows and keeps evening overtime', async () => {
  const tables = { employees: [{ id: 'employee', name: 'Employee' }], time_entries: [
    generatedRow(1, 'employee', '2026-10-01', { hour_type: 'wfh', notes: 'manual' }),
    generatedRow(2, 'employee', '2026-10-02', { hour_type: 'overtime', clock_out: '10:00:00' }),
    generatedRow(3, 'employee', '2026-10-05', { hour_type: 'overtime', clock_in: '18:00:00', clock_out: '20:00:00' }),
  ] };
  const result = await timeService(queryFixture(tables, {}, { persist: true })).restoreStandardHoursForLeave({ employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-05' });
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 2);
  assert.equal(tables.time_entries.length, 4);
});

test('demo: changing approved employee restores OLD employee and cleans NEW employee only', async () => {
  const tables = { employees: [{ id: 'employee' }, { id: 'other' }], leave_requests: [
    { id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-02', status: 'approved' },
  ], time_entries: [generatedRow(1, 'other', '2026-10-01'), generatedRow(2, 'other', '2026-10-02')] };
  const result = await timeService(queryFixture(tables, {}, { persist: true }), true).updateLeaveRequest(1, { employeeId: 'other' }, { restoreStandardHours: true });
  assert.equal(result.success, true);
  assert.equal(result.generated.removed, 2);
  assert.equal(result.generated.restored.created, 2);
  assert.equal(tables.time_entries.every(row => row.employee_id === 'employee'), true);
});

test('restoration failure is reported as partial success after the leave change commits', async () => {
  const client = queryFixture({ leave_requests: [{ id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-01', status: 'approved' }] }, { employees: { message: 'Roster unavailable' } }, { persist: true });
  const result = await timeService(client).revertLeaveApproval(1, 'manager', { restoreStandardHours: true });
  assert.equal(result.success, true);
  assert.equal(result.data.status, 'pending');
  assert.equal(result.generated.restored.success, false);
  assert.match(result.generated.warning, /Leave saved; standard-hour restoration failed/);
});

test('restore respects another overlapping approval and already generated attendance', async () => {
  const tables = { employees: [{ id: 'employee' }, { id: 'other' }], leave_requests: [
    { id: 1, employee_id: 'employee', start_date: '2026-09-04', end_date: '2026-09-08', status: 'approved' },
    { id: 2, employee_id: 'employee', start_date: '2026-09-07', end_date: '2026-09-07', status: 'approved' },
  ], time_entries: [generatedRow(1, 'employee', '2026-09-08'), generatedRow(2, 'other', '2026-09-04')] };
  const service = timeService(queryFixture(tables, {}, { persist: true }));
  const result = await service.revertLeaveApproval(1, 'manager', { restoreStandardHours: true });
  assert.equal(result.generated.restored.created, 1);
  assert.equal(result.generated.restored.skipped, 2);
  assert.equal(rowKeys(tables.time_entries), 'employee:2026-09-04:09:00:regular,employee:2026-09-08:09:00:regular,other:2026-09-04:09:00:regular');
});

test('demo and production services calculate the same October attendance', async () => {
  const entries = [generatedRow(1, 'employee', '2026-10-01'), generatedRow(2, 'employee', '2026-10-02', { hour_type: 'on_leave' })];
  const leave = [{ employee_id: 'employee', start_date: '2026-09-30', end_date: '2026-10-01', status: 'approved' }];
  const production = timeService(queryFixture({ time_entries: entries, leave_requests: leave }));
  const demo = loadSource('src/services/timeTrackingService.js', {
    '../utils/fetchAllRows.js': { fetchAllRows },
  '../config/supabaseClient': { supabase: {} },
    '../utils/demoHelper': { isDemoMode: () => true, getDemoTimeEntries: () => entries, getDemoLeaveRequests: () => leave },
    '../utils/demoStorage': {}, '../utils/timeEntryHelpers.js': timeHelpers,
    '../utils/reportExportHelpers.js': reportHelpers, '../utils/attendanceRules.js': attendanceRules, './documentService.js': {},
  });
  const liveResult = await production.getTimeTrackingSummary('employee', 10, 2026);
  const demoResult = await demo.getTimeTrackingSummary('employee', 10, 2026);
  assert.equal(JSON.stringify(demoResult.data), JSON.stringify(liveResult.data));
  const overview = await demo.getOverviewEmployeeSummaries(10, 2026, [{ id: 'employee' }]);
  assert.equal(overview.data[0].data.leave_days, 2);
  assert.equal(overview.data[0].data.days_worked, 0);
});

for (const timezone of ['Asia/Ho_Chi_Minh', 'UTC', 'America/Los_Angeles']) {
  test(`month boundaries retain calendar days in ${timezone}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { getMonthDateRange } from './src/utils/timeEntryHelpers.js';
      console.log(JSON.stringify([getMonthDateRange(9, 2026), getMonthDateRange(2, 2024)]));
    `], { encoding: 'utf8', env: { ...process.env, TZ: timezone } });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [
      { startDate: '2026-09-01', endDate: '2026-09-30' },
      { startDate: '2024-02-01', endDate: '2024-02-29' },
    ]);
  });
}

test('approved leave replaces regular hours on the same weekday and keeps other hour types', async () => {
  const client = queryFixture({
    time_entries: [
      { employee_id: 'employee', date: '2026-09-01', hours: 8, hour_type: 'regular', status: 'approved' },
      { employee_id: 'employee', date: '2026-09-02', hours: 8, hour_type: 'regular', status: 'approved' },
      { employee_id: 'employee', date: '2026-09-03', hours: 2, hour_type: 'overtime', status: 'approved' },
    ],
    leave_requests: [
      { employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-03', status: 'approved' },
    ],
  });
  const service = timeService(client);
  const september = await service.getTimeTrackingSummary('employee', 9, 2026);
  assert.equal(september.data.leave_days, 3);
  assert.equal(september.data.days_worked, 0);
  assert.equal(september.data.regular_hours, 0);
  assert.equal(september.data.overtime_hours, 2);
  assert.equal(september.data.total_hours, 2);
});

test('bulk standard hours skip weekdays covered by approved leave', async () => {
  const client = queryFixture({
    employees: [{ id: 'employee', name: 'Employee' }, { id: 'other', name: 'Other' }],
    leave_requests: [
      { id: 7, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-01', status: 'approved' },
    ],
  });
  const service = timeService(client);
  const filled = await service.fillStandardHoursForAllEmployees({
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    adminName: 'Ada',
  });
  assert.equal(filled.success, true);
  assert.equal(filled.created, 3);
  assert.equal(filled.skipped, 1);
  const inserted = client.calls.find((call) => call.table === 'time_entries' && call.method === 'insert').args[0];
  assert.equal(
    [...inserted].map((row) => `${row.employee_id}:${row.date}`).sort().join(','),
    'employee:2026-09-02,other:2026-09-01,other:2026-09-02'
  );
  assert.equal([...inserted].every((row) => String(row.notes).startsWith('Standard hours filled by admin:')), true);
});

test('pending and rejected leave do not block standard-hour fill', async () => {
  const client = queryFixture({
    employees: [{ id: 'employee', name: 'Employee' }],
    leave_requests: [
      { id: 1, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-01', status: 'pending' },
      { id: 2, employee_id: 'employee', start_date: '2026-09-02', end_date: '2026-09-02', status: 'rejected' },
    ],
  });
  const service = timeService(client);
  const filled = await service.fillStandardHoursForAllEmployees({
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    adminName: 'Ada',
  });
  assert.equal(filled.created, 2);
  assert.equal(filled.skipped, 0);
});

test('fill across a weekend skips only the approved weekdays', async () => {
  const client = queryFixture({
    employees: [{ id: 'employee', name: 'Employee' }, { id: 'other', name: 'Other' }],
    leave_requests: [
      { id: 8, employee_id: 'employee', start_date: '2026-09-04', end_date: '2026-09-07', status: 'approved' },
    ],
  });
  const service = timeService(client);
  const filled = await service.fillStandardHoursForAllEmployees({
    startDate: '2026-09-04',
    endDate: '2026-09-07',
    adminName: 'Ada',
  });
  assert.equal(filled.created, 2);
  assert.equal(filled.skipped, 2);
  assert.equal(filled.weekendsExcluded, 2);
  const inserted = client.calls.find((call) => call.table === 'time_entries' && call.method === 'insert').args[0];
  assert.equal(
    [...inserted].map((row) => `${row.employee_id}:${row.date}`).sort().join(','),
    'other:2026-09-04,other:2026-09-07'
  );
});

test('demo: approving leave removes the bulk stamp and leaves a hand-entered punch', async () => {
  const client = queryFixture({
    leave_requests: [
      { id: 7, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-01', status: 'pending' },
    ],
    time_entries: [
      {
        id: 11,
        employee_id: 'employee',
        date: '2026-09-01',
        hour_type: 'regular',
        clock_in: '09:00:00',
        clock_out: '17:00:00',
        notes: 'Standard hours filled by admin: Ada',
        status: 'approved',
      },
      {
        id: 12,
        employee_id: 'employee',
        date: '2026-09-01',
        hour_type: 'regular',
        clock_in: '09:00:00',
        clock_out: '17:00:00',
        notes: 'Came in for a handover',
        status: 'approved',
      },
    ],
  }, {}, { persist: true });
  const service = timeService(client, true);
  const approved = await service.updateLeaveRequestStatus(7, 'approved', 'manager');
  assert.equal(approved.success, true);
  assert.equal(approved.generated.removed, 1);
  assert.deepEqual(client.tables.time_entries.map(row => row.id), [12]);
});

test('demo: approving a multi-day leave removes only that employee\'s bulk weekdays', async () => {
  const client = queryFixture({
    leave_requests: [
      { id: 9, employee_id: 'employee', start_date: '2026-09-04', end_date: '2026-09-07', status: 'pending' },
    ],
    time_entries: [
      { id: 21, employee_id: 'employee', date: '2026-09-04', hour_type: 'regular', clock_in: '09:00:00', clock_out: '17:00:00', notes: 'Standard hours filled by admin: Ada' },
      { id: 22, employee_id: 'employee', date: '2026-09-07', hour_type: 'regular', clock_in: '09:00:00', clock_out: '17:00:00', notes: 'Standard hours filled by admin: Ada' },
      { id: 23, employee_id: 'employee', date: '2026-09-04', hour_type: 'regular', clock_in: '09:12:00', clock_out: '17:08:00', notes: 'Came in late' },
      { id: 24, employee_id: 'employee', date: '2026-09-07', hour_type: 'overtime', clock_in: '18:00:00', clock_out: '20:00:00', notes: 'Standard hours filled by admin: Ada' },
      { id: 25, employee_id: 'other', date: '2026-09-04', hour_type: 'regular', clock_in: '09:00:00', clock_out: '17:00:00', notes: 'Standard hours filled by admin: Ada' },
    ],
  }, {}, { persist: true });
  const service = timeService(client, true);
  const approved = await service.updateLeaveRequestStatus(9, 'approved', 'manager');
  assert.equal(approved.success, true);
  assert.equal(approved.generated.removed, 2);
  assert.deepEqual(client.tables.time_entries.map(row => row.id), [23, 24, 25]);

  const again = await service.updateLeaveRequestStatus(9, 'approved', 'manager');
  assert.equal(again.success, true);
  assert.equal(again.generated.removed, 0);
  assert.deepEqual(client.tables.time_entries.map(row => row.id), [23, 24, 25]);
});

test('rejecting leave does not delete attendance', async () => {
  const client = queryFixture({
    leave_requests: [
      { id: 7, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-01', status: 'approved' },
    ],
    time_entries: [
      { id: 11, employee_id: 'employee', date: '2026-09-01', hour_type: 'regular', clock_in: '09:00:00', clock_out: '17:00:00', notes: 'Standard hours filled by admin: Ada' },
    ],
  });
  const service = timeService(client);
  const rejected = await service.updateLeaveRequestStatus(7, 'rejected', 'manager', 'no');
  assert.equal(rejected.success, true);
  assert.equal(client.calls.some((call) => call.table === 'time_entries' && call.method === 'delete'), false);
});

test('actual attendance service includes month end and clips overlapping leave in both months', async () => {
  const client = queryFixture({
    time_entries: [{ employee_id: 'employee', date: '2026-09-30', hours: 8, hour_type: 'regular', status: 'approved' }],
    leave_requests: [{ employee_id: 'employee', start_date: '2026-08-31', end_date: '2026-09-02', status: 'approved' }],
  });
  const service = timeService(client);
  const august = await service.getTimeTrackingSummary('employee', 8, 2026);
  const september = await service.getTimeTrackingSummary('employee', 9, 2026);
  assert.equal(august.data.leave_days, 1);
  assert.equal(september.data.leave_days, 2);
  assert.equal(september.data.total_hours, 8);
  assert.equal(september.data.days_worked, 1);
});

test('leave from 30 Sep to 2 Oct counts one September day and two October days; pending counts nothing', async () => {
  const approved = queryFixture({
    time_entries: [],
    leave_requests: [{ employee_id: 'employee', start_date: '2026-09-30', end_date: '2026-10-02', status: 'approved', days_count: 3 }],
  });
  const pending = queryFixture({
    time_entries: [],
    leave_requests: [{ employee_id: 'employee', start_date: '2026-09-30', end_date: '2026-10-02', status: 'pending', days_count: 3 }],
  });
  const approvedService = timeService(approved);
  const pendingService = timeService(pending);
  assert.equal((await approvedService.getTimeTrackingSummary('employee', 9, 2026)).data.leave_days, 1);
  assert.equal((await approvedService.getTimeTrackingSummary('employee', 10, 2026)).data.leave_days, 2);
  assert.equal((await pendingService.getTimeTrackingSummary('employee', 9, 2026)).data.leave_days, 0);
  assert.equal((await pendingService.getTimeTrackingSummary('employee', 10, 2026)).data.leave_days, 0);
});

test('overlapping approved requests count each weekday once', async () => {
  const client = queryFixture({
    time_entries: [],
    leave_requests: [
      { employee_id: 'employee', start_date: '2026-09-10', end_date: '2026-09-12', status: 'approved', days_count: 2 },
      { employee_id: 'employee', start_date: '2026-09-11', end_date: '2026-09-15', status: 'approved', days_count: 3 },
    ],
  });
  const september = await timeService(client).getTimeTrackingSummary('employee', 9, 2026);
  // Thu 10, Fri 11, Mon 14, Tue 15 — Sat 12 and Sun 13 are not leave days.
  assert.equal(september.data.leave_days, 4);
});

test('a month spent entirely on approved leave reports zero worked days, not a stale figure', async () => {
  const client = queryFixture({
    time_entries: [
      { employee_id: 'employee', date: '2026-09-01', hours: 8, hour_type: 'regular', status: 'approved', notes: BULK_NOTE },
      { employee_id: 'employee', date: '2026-09-02', hours: 8, hour_type: 'wfh', status: 'approved' },
    ],
    leave_requests: [{ employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-30', status: 'approved' }],
    time_tracking_summary: [{ employee_id: 'employee', month: 9, year: 2026, days_worked: 22, leave_days: 0, regular_hours: 176 }],
  });
  const september = await timeService(client).getTimeTrackingSummary('employee', 9, 2026);
  assert.equal(september.data.days_worked, 0);
  assert.equal(september.data.leave_days, 22);
  assert.equal(september.data.regular_hours, 0);
  assert.equal(september.data.total_hours, 0);
});

test('overtime on an approved leave day keeps the overtime and drops regular and WFH hours', async () => {
  const client = queryFixture({
    time_entries: [
      { employee_id: 'employee', date: '2026-09-01', hours: 8, hour_type: 'regular', status: 'approved' },
      { employee_id: 'employee', date: '2026-09-01', hours: 3, hour_type: 'wfh', status: 'approved' },
      { employee_id: 'employee', date: '2026-09-01', hours: 2, hour_type: 'overtime', status: 'approved' },
    ],
    leave_requests: [{ employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-01', status: 'approved' }],
  });
  const september = await timeService(client).getTimeTrackingSummary('employee', 9, 2026);
  assert.equal(september.data.leave_days, 1);
  assert.equal(september.data.days_worked, 0);
  assert.equal(september.data.regular_hours, 0);
  assert.equal(september.data.overtime_hours, 2);
  assert.equal(september.data.total_hours, 2);
});

test('filling standard hours twice creates no duplicate generated rows', async () => {
  const tables = {
    employees: [{ id: 'employee', name: 'Employee' }],
    time_entries: [],
    leave_requests: [],
  };
  const service = timeService(queryFixture(tables, {}, { persist: true }));
  const first = await service.fillStandardHoursForAllEmployees({ startDate: '2026-09-01', endDate: '2026-09-02', adminName: 'Ada' });
  const second = await service.fillStandardHoursForAllEmployees({ startDate: '2026-09-01', endDate: '2026-09-02', adminName: 'Ada' });
  assert.equal(first.created, 2);
  assert.equal(second.created, 0);
  assert.equal(second.skipped, 2);
  assert.equal(rowKeys(tables.time_entries), 'employee:2026-09-01:09:00:regular,employee:2026-09-02:09:00:regular');
});

test('reverting an approval without restore only changes the status', async () => {
  const tables = {
    employees: [{ id: 'employee', name: 'Employee' }],
    leave_requests: [{ id: 7, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-02', status: 'approved' }],
    time_entries: [{ id: 30, employee_id: 'employee', date: '2026-09-01', hours: 2, hour_type: 'overtime', clock_in: '18:00:00', clock_out: '20:00:00', notes: 'Release night', status: 'approved' }],
  };
  const client = queryFixture(tables, {}, { persist: true });
  const service = timeService(client);
  const reverted = await service.revertLeaveApproval(7, 'manager');
  assert.equal(reverted.success, true);
  assert.equal(tables.leave_requests[0].status, 'pending');
  assert.equal(tables.leave_requests[0].approved_by, null);
  assert.equal(client.calls.some((call) => call.table === 'time_entries' && ['insert', 'delete'].includes(call.method)), false);
  assert.equal(tables.time_entries.length, 1);
});

test('reverting an approval with restore recreates only the safe generated weekdays, once', async () => {
  const tables = {
    employees: [{ id: 'employee', name: 'Employee' }, { id: 'other', name: 'Other' }],
    // Fri 4 Sep – Tue 8 Sep: weekdays 4, 7, 8.
    leave_requests: [{ id: 9, employee_id: 'employee', start_date: '2026-09-04', end_date: '2026-09-08', status: 'approved' }],
    time_entries: [
      // Hand-entered attendance on the Friday: nothing generated must land on top of it.
      { id: 41, employee_id: 'employee', date: '2026-09-04', hours: 8, hour_type: 'regular', clock_in: '09:12:00', clock_out: '17:08:00', notes: 'Came in late', status: 'approved' },
      // Overtime on the Monday: stays, and standard hours may still be restored beside it.
      { id: 42, employee_id: 'employee', date: '2026-09-07', hours: 2, hour_type: 'overtime', clock_in: '18:00:00', clock_out: '20:00:00', notes: 'Release night', status: 'approved' },
      // Someone else's generated row in the same range: untouched.
      generatedRow(43, 'other', '2026-09-07'),
    ],
  };
  const service = timeService(queryFixture(tables, {}, { persist: true }));

  const reverted = await service.revertLeaveApproval(9, 'manager', { restoreStandardHours: true, adminName: 'Ada' });
  assert.equal(reverted.success, true);
  assert.equal(reverted.generated.restored.created, 2);
  assert.equal(tables.leave_requests[0].status, 'pending');

  const ours = tables.time_entries.filter((row) => row.employee_id === 'employee');
  assert.equal(rowKeys(generatedRows(ours)), 'employee:2026-09-07:09:00:regular,employee:2026-09-08:09:00:regular');
  assert.ok(tables.time_entries.find((row) => row.id === 41), 'hand-entered attendance kept');
  assert.ok(tables.time_entries.find((row) => row.id === 42), 'overtime kept');
  assert.ok(tables.time_entries.find((row) => row.id === 43), "other employee's row kept");
  assert.equal(tables.time_entries.some((row) => ['2026-09-05', '2026-09-06'].includes(row.date)), false, 'weekend skipped');

  // Running the restore again must not duplicate anything.
  const again = await service.restoreStandardHoursForLeave(tables.leave_requests[0], 'Ada');
  assert.equal(again.created, 0);
  assert.equal(rowKeys(generatedRows(tables.time_entries.filter((row) => row.employee_id === 'employee'))), 'employee:2026-09-07:09:00:regular,employee:2026-09-08:09:00:regular');
});

test('demo: editing approved leave to new dates reconciles generated hours over both ranges', async () => {
  const tables = {
    employees: [{ id: 'employee', name: 'Employee' }],
    leave_requests: [{ id: 5, employee_id: 'employee', start_date: '2026-09-30', end_date: '2026-10-02', status: 'approved' }],
    time_entries: [
      generatedRow(51, 'employee', '2026-10-05'),
      generatedRow(52, 'employee', '2026-10-06'),
      { id: 53, employee_id: 'employee', date: '2026-10-07', hours: 8, hour_type: 'regular', clock_in: '09:00:00', clock_out: '17:00:00', notes: 'Manual entry', status: 'approved' },
    ],
  };
  const client = queryFixture(tables, {}, { persist: true });
  const service = timeService(client, true);

  const edited = await service.updateLeaveRequest(5, { startDate: '2026-10-05', endDate: '2026-10-07', status: 'approved' }, {
    approverId: 'manager', adminName: 'Ada', restoreStandardHours: true,
  });
  assert.equal(edited.success, true);

  assert.equal(tables.leave_requests[0].start_date, '2026-10-05');
  assert.equal(tables.leave_requests[0].end_date, '2026-10-07');

  // New range: generated rows removed, the manual 09:00–17:00 row kept.
  assert.equal(tables.time_entries.some((row) => row.id === 51 || row.id === 52), false);
  assert.ok(tables.time_entries.find((row) => row.id === 53));
  // Old range released: Wed 30 Sep, Thu 1 Oct, Fri 2 Oct get their standard hours back.
  assert.equal(rowKeys(generatedRows(tables.time_entries)), 'employee:2026-09-30:09:00:regular,employee:2026-10-01:09:00:regular,employee:2026-10-02:09:00:regular');
});

test('demo: editing approved leave without restore leaves attendance alone and still clears the new range', async () => {
  const tables = {
    employees: [{ id: 'employee', name: 'Employee' }],
    leave_requests: [{ id: 5, employee_id: 'employee', start_date: '2026-09-30', end_date: '2026-10-02', status: 'approved' }],
    time_entries: [generatedRow(51, 'employee', '2026-10-05')],
  };
  const client = queryFixture(tables, {}, { persist: true });
  const edited = await timeService(client, true).updateLeaveRequest(5, { startDate: '2026-10-05', endDate: '2026-10-07' }, { approverId: 'manager' });
  assert.equal(edited.success, true);
  assert.equal(tables.time_entries.length, 0);
  assert.equal(client.calls.some((call) => call.table === 'time_entries' && call.method === 'insert'), false);
});

test('demo: status transitions: pending→approved clears generated rows, approved→rejected does not touch attendance', async () => {
  const tables = {
    employees: [{ id: 'employee', name: 'Employee' }],
    leave_requests: [{ id: 3, employee_id: 'employee', start_date: '2026-09-01', end_date: '2026-09-01', status: 'pending' }],
    time_entries: [generatedRow(61, 'employee', '2026-09-01')],
  };
  const client = queryFixture(tables, {}, { persist: true });
  const service = timeService(client, true);

  assert.equal((await service.updateLeaveRequestStatus(3, 'approved', 'manager')).success, true);
  assert.equal(tables.leave_requests[0].status, 'approved');
  assert.equal(tables.time_entries.length, 0);

  assert.equal((await service.updateLeaveRequestStatus(3, 'rejected', 'manager', 'plans changed')).success, true);
  assert.equal(tables.leave_requests[0].status, 'rejected');
  assert.equal(tables.leave_requests[0].rejection_reason, 'plans changed');
  assert.equal(client.calls.some((call) => call.table === 'time_entries' && call.method === 'insert'), false);
  assert.equal(tables.time_entries.length, 0);
});

test('updateLeaveRequest rejects an inverted range and an empty change', async () => {
  const client = queryFixture({ leave_requests: [{ id: 5, employee_id: 'employee', start_date: '2026-09-30', end_date: '2026-10-02', status: 'approved' }] });
  const service = timeService(client);
  assert.equal((await service.updateLeaveRequest(5, { startDate: '2026-10-07', endDate: '2026-10-05' })).success, false);
  assert.equal((await service.updateLeaveRequest(5, {})).success, false);
  assert.equal(client.calls.some((call) => call.method === 'update'), false);
});

const recruitmentService = (client) => loadSource('src/services/recruitmentService.js', {
  '../utils/fetchAllRows.js': { fetchAllRows },
  '../config/supabaseClient': { supabase: client },
  '../utils/demoHelper': { isDemoMode: () => false },
  '../utils/localeFormat': {},
});

test('interview reads and writes use scheduled_time while preserving the UI date alias', async () => {
  const client = queryFixture({ interview_schedules: [{ id: 1, application_id: 'uuid-application' }] });
  const service = recruitmentService(client);
  const result = await service.createInterviewSchedule({ application_id: 'uuid-application', scheduled_date: '2026-10-01T02:00:00Z', interview_type: 'video' });
  assert.equal(result.success, true);
  const insert = client.calls.find(call => call.method === 'insert').args[0][0];
  assert.equal(insert.scheduled_time, '2026-10-01T02:00:00Z');
  assert.equal('scheduled_date' in insert, false);
  await service.getUpcomingInterviews();
  await service.getInterviewsByApplication('uuid-application');
  await service.updateInterviewSchedule(1, { scheduled_date: '2026-10-02T02:00:00Z' });
  for (const call of client.calls.filter(call => ['order', 'gte'].includes(call.method))) assert.equal(call.args[0], 'scheduled_time');
  for (const call of client.calls.filter(call => call.method === 'select')) assert.match(call.args[0], /scheduled_date:scheduled_time/);
  assert.equal(client.calls.some(call => call.table === 'applications'), false, 'application stage is maintained transactionally by the database');
});

test('old public URLs and expired signed URLs resolve to the same protected object', () => {
  const origin = 'https://fixture.supabase.co';
  const path = 'time-proofs/employee_2026-09-22_document name.pdf';
  for (const access of ['public', 'sign', 'authenticated']) {
    assert.equal(documentPaths.getEmployeeDocumentPath(`${origin}/storage/v1/object/${access}/employee-documents/${encodeURI(path)}?token=expired`, origin), path);
  }
  assert.equal(documentPaths.getEmployeeDocumentPath(path, origin), path);
  assert.equal(documentPaths.getEmployeeDocumentPath('https://example.test/resume.pdf', origin), null);
  assert.throws(() => documentPaths.getEmployeeDocumentPath('../another-bucket/file', origin));
});

test('document signing is short-lived, renews old links, and propagates denied access', async () => {
  const signed = [];
  let deny = false;
  const service = loadSource('src/services/documentService.js', {
    '../config/supabaseClient.js': { supabase: { storage: { from(bucket) {
      assert.equal(bucket, 'employee-documents');
      return { async createSignedUrl(path, ttl) {
        signed.push({ path, ttl });
        return deny ? { error: new Error('Access denied') } : { data: { signedUrl: 'fresh-link' } };
      }, async download(path) { return { data: new Blob([path]) }; } };
    } } } },
    '../utils/documentPaths.js': documentPaths,
  });
  const result = await service.getDocumentDownloadUrl('https://fixture.supabase.co/storage/v1/object/public/employee-documents/employee_123.pdf');
  assert.equal(result.url, 'fresh-link');
  assert.deepEqual(signed, [{ path: 'employee_123.pdf', ttl: 600 }]);
  deny = true;
  await assert.rejects(service.getDocumentDownloadUrl('employee_123.pdf'), /Access denied/);
  assert.equal(await (await service.downloadEmployeeDocument('employee_123.pdf')).text(), 'employee_123.pdf');
});

test('failed source reads never return old stored summaries or fabricated successful zeros', async () => {
  const client = queryFixture({ time_tracking_summary: [{ employee_id: 'employee', month: 10, year: 2026, total_hours: 176 }] }, { leave_requests: { message: 'Leave unavailable' } });
  const service = timeService(client);
  const individual = await service.getTimeTrackingSummary('employee', 10, 2026);
  const overview = await service.getOverviewEmployeeSummaries(10, 2026, [{ id: 'employee' }]);
  assert.equal(individual.success, false);
  assert.equal(individual.data, null);
  assert.equal(overview.success, false);
  assert.match(individual.error, /Leave unavailable/);
  assert.equal(client.calls.some(call => call.table === 'time_tracking_summary'), false);
});

test('attendance sources load past the server row cap for individuals overview and report ledgers', async () => {
  const entries = Array.from({ length: 1105 }, (_, id) => generatedRow(id, 'employee', '2026-10-05', { hours: 1 }));
  const client = queryFixture({ time_entries: entries, time_entries_detailed: entries,
    leave_requests: [{ id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-02', status: 'approved' }],
    overtime_logs: [{ id: 1, employee_id: 'employee', date: '2026-10-01', hours: 2, overtime_type: 'regular', status: 'approved' }],
  }, {}, { maxRows: 128 });
  const service = timeService(client);
  const summary = await service.getTimeTrackingSummary('employee', 10, 2026);
  assert.equal(summary.data.total_hours, 1107);
  assert.equal(summary.data.leave_days, 2);
  const overview = await service.getOverviewEmployeeSummaries(10, 2026, [{ id: 'employee' }]);
  assert.equal(overview.data[0].data.total_hours, 1107);
  assert.equal((await service.getAllTimeEntriesDetailed()).data.length, 1105);
  assert.equal((await service.getTimeEntries('employee')).data.length, 1105);
});

test('leave changed between read and update causes a conflict and never restores stale dates', async () => {
  for (const action of ['status', 'edit']) {
    const row = { id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-02', status: 'approved' };
    const client = queryFixture({ leave_requests: [row] }, {}, { persist: true });
    const from = client.from.bind(client);
    let reads = 0;
    client.from = table => {
      if (table === 'leave_requests' && ++reads === 2) row.start_date = '2026-10-02';
      return from(table);
    };
    const service = timeService(client);
    const result = action === 'status'
      ? await service.revertLeaveApproval(1, 'manager', { restoreStandardHours: true })
      : await service.updateLeaveRequest(1, { startDate: '2026-10-05', endDate: '2026-10-07' }, { restoreStandardHours: true });
    assert.equal(result.code, 'LEAVE_CONFLICT');
    assert.equal(row.status, 'approved');
    assert.equal(row.start_date, '2026-10-02');
    assert.equal(client.calls.some(call => call.table === 'time_entries'), false);
  }
});

test('stale modal coverage is rejected and a nullable status is compared using SQL IS NULL', async () => {
  const row = { id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-02', status: null };
  const client = queryFixture({ leave_requests: [row] }, {}, { persist: true });
  const service = timeService(client);
  assert.equal((await service.updateLeaveRequest(1, { reason: 'changed' }, { expectedLeave: { ...row, status: 'approved' } })).code, 'LEAVE_CONFLICT');
  assert.equal((await service.updateLeaveRequestStatus(1, 'approved', 'manager')).success, true);
  assert.ok(client.calls.some(call => call.method === 'is' && call.args[0] === 'status'));
});

test('explicit restoration retry retains released dates after the status change and is idempotent', async () => {
  let unavailable = true;
  const client = queryFixture({ employees: [{ id: 'employee' }], leave_requests: [{ id: 1, employee_id: 'employee', start_date: '2026-10-01', end_date: '2026-10-02', status: 'approved' }], time_entries: [] },
    { employees: () => unavailable ? { message: 'Offline' } : null }, { persist: true });
  const service = timeService(client);
  const result = await service.updateLeaveRequest(1, { startDate: '2026-10-02' }, { restoreStandardHours: true });
  assert.equal(result.success, true);
  assert.equal(result.generated.restoreRetry.dates.join(','), '2026-10-01');
  unavailable = false;
  assert.equal((await service.retryStandardHoursRestoration(result.generated.restoreRetry)).created, 1);
  assert.equal((await service.retryStandardHoursRestoration(result.generated.restoreRetry)).created, 0);
  assert.equal(client.tables.time_entries.length, 1);
  assert.equal(client.tables.time_entries[0].date, '2026-10-01');
});

test('a competing standard fill is reread after unique violation without duplicating its row', async () => {
  let collision = true;
  const tables = { employees: [{ id: 'employee' }], time_entries: [] };
  const client = queryFixture(tables, { time_entries: calls => {
    if (collision && calls.some(call => call.method === 'insert')) {
      collision = false;
      tables.time_entries.push(generatedRow('other-fill', 'employee', '2026-10-01'));
      return { code: '23505', message: 'Concurrent duplicate' };
    }
    return null;
  } }, { persist: true });
  const result = await timeService(client).fillStandardHoursForAllEmployees({ startDate: '2026-10-01', endDate: '2026-10-02' });
  assert.equal(result.success, true);
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 1);
  assert.equal(tables.time_entries.length, 2);
});
