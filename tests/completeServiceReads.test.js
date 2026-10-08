import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';
import { fetchAllRows } from '../src/utils/fetchAllRows.js';

function services(client) {
  const shared = {
    '../utils/fetchAllRows.js': { fetchAllRows },
    '../config/supabaseClient': { supabase: client },
    '../config/supabaseClient.js': { supabase: client },
    '../utils/demoHelper': { isDemoMode: () => false },
    '../utils/demoHelper.js': { isDemoMode: () => false },
    '../utils/supabaseTimeout.js': { withTimeout: page => page },
    '../config/requestTimeouts.js': { DEFAULT_REQUEST_TIMEOUT: 1000 },
    '../utils/demoStorage.js': {}, '../utils/pdfPreviewUrl.js': {}, './documentService.js': {},
  };
  return {
    ...loadSource('src/services/workloadService.js', shared),
    ...loadSource('src/services/performanceService.js', shared),
    ...loadSource('src/services/employeeService.js', shared),
    ...loadSource('src/services/punchClockService.js', shared),
  };
}

const rows = Array.from({ length: 1001 }, (_, id) => ({ id, employee_id: 'person', employeeId: 'person',
  name: `Person ${id}`, department: 'Alpha', status: 'Active', review_date: '2026-10-01',
  target_date: '2026-10-01', due_date: '2026-10-01', progress_percentage: 30, photo: 'portrait',
  date: '2026-10-01', clock_in: '09:00:00', breaks: [],
}));
const cases = [
  ['getAllTasks','workload_tasks',{}], ['getEmployeeTasks','workload_tasks','person'],
  ['getAllPerformanceReviews','performance_reviews',{}], ['getAllPerformanceGoals','performance_goals',{}],
  ['getAllEmployees','employees',{}], ['getEmployeesByDepartment','employees','Alpha'],
  ['getEmployeesByStatus','employees','Active'], ['getAllSkillsAssessments','skills_assessments',{}],
  ['getGoalsWithProgress','goals_with_progress',null], ['getSkillsByEmployee','skills_assessments','person'],
  ['getOpenPunches','open_punches','2026-10-01'],
];
for (const cap of [1000, 75]) {
  for (const [method, table, filter] of cases) {
    test(`${method} returns all 1001 records with server cap ${cap}`, async () => {
      const client = queryFixture({ [table]: rows }, {}, { maxRows: cap });
      const result = await services(client)[method](filter);
      assert.equal(result.success, true);
      assert.equal(result.data.length, 1001);
      const select = client.calls.find(call => call.method === 'select');
      assert.equal(select.args[1].count, 'exact');
      assert.ok(client.calls.some(call => call.method === 'order' && call.args[0] === (table === 'open_punches' ? 'employee_id' : 'id')));
    });
  }
}

test('complete reads keep filters and goal progress mapping across pages', async () => {
  const client = queryFixture({ performance_goals: [...rows, { id: 1002, employee_id: 'other' }] }, {}, { maxRows: 75 });
  const result = await services(client).getAllPerformanceGoals({ employeeId: 'person' });
  assert.equal(result.data.length, 1001);
  assert.equal(result.data.at(-1).progress, 30);
});

test('later-page failure cannot return a partial successful task list', async () => {
  const client = queryFixture({ workload_tasks: rows }, { workload_tasks: calls =>
    calls.some(call => call.method === 'range' && call.args[0] > 0) ? { message: 'Page failed' } : null,
  }, { maxRows: 75 });
  const result = await services(client).getAllTasks();
  assert.equal(result.success, false);
  assert.match(result.error, /Page failed/);
  assert.equal(result.data, undefined);
});

test('roster portraits and department totals include employees after the response cap', async () => {
  const client = queryFixture({ employees: rows }, {}, { maxRows: 75 });
  const api = services(client);
  assert.equal(Object.keys((await api.getEmployeePhotos()).data).length, 1001);
  assert.equal((await api.getDepartmentDistribution()).data.Alpha, 1001);
});

test('workload statistics include all pages', async () => {
  const client = queryFixture({ workload_tasks: rows.map(row => ({ ...row, status: 'completed' })) }, {}, { maxRows: 75 });
  const api = services(client);
  assert.equal((await api.getEmployeeTaskStats('person')).data.completed, 1001);
  assert.equal((await api.getOrganizationTaskStats()).data.totalTasks, 1001);
});

test('summary and matrix views paginate using their actual keys', async () => {
  const client = queryFixture({ employee_performance_summary: rows, skills_matrix: rows }, {}, { maxRows: 75 });
  const api = services(client);
  assert.equal((await api.getEmployeePerformanceSummary()).data.length, 1001);
  assert.equal((await api.getSkillsMatrix()).data.length, 1001);
  const orders = client.calls.filter(call => call.method === 'order').map(call => call.args[0]);
  assert.deepEqual(orders, ['employee_id', 'department', 'skill_name', 'skill_category']);
});
