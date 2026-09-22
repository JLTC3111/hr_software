import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as timeHelpers from '../src/utils/timeEntryHelpers.js';
import * as reportHelpers from '../src/utils/reportExportHelpers.js';
import * as documentPaths from '../src/utils/documentPaths.js';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';

const timeService = (client) => loadSource('src/services/timeTrackingService.js', {
  '../config/supabaseClient': { supabase: client },
  '../utils/demoHelper': { isDemoMode: () => false },
  '../utils/demoStorage': {},
  '../utils/timeEntryHelpers.js': timeHelpers,
  '../utils/reportExportHelpers.js': reportHelpers,
  './documentService.js': {},
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

const recruitmentService = (client) => loadSource('src/services/recruitmentService.js', {
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
