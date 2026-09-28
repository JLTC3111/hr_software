import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows } from '../src/utils/fetchAllRows.js';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';

const fixture = (tables, errors = {}, options = {}) => {
  const client = queryFixture(tables, errors, options);
  const service = loadSource('src/services/ugcTranslationService.js', {
    '../config/supabaseClient': { supabase: client },
    '../utils/demoHelper': { isDemoMode: () => false },
    '../utils/fetchAllRows.js': { fetchAllRows },
  });
  return { client, service };
};

test('Studio loads task comments after record 500 even with a smaller server page cap', async () => {
  const tasks = Array.from({ length: 701 }, (_, id) => ({ id, title: `Task ${id}`, comments: `Comment ${id}` }));
  const { client, service } = fixture({ workload_tasks: tasks }, {}, { maxRows: 137 });
  const result = await service.fetchTranslatableRecords();
  assert.equal(result.success, true);
  assert.equal(result.data.length, 1402);
  assert.equal(result.data.filter(row => row.field === 'comments').length, 701);
  assert.equal(result.data.find(row => row.key === 'task:700:comments').sourceText, 'Comment 700');
  assert.ok(!client.calls.some(call => call.method === 'limit'));
  assert.equal(client.calls.filter(call => call.table === 'workload_tasks' && call.method === 'range').length, 6);
});

test('goal comments and check-in notes have distinct editable keys and parent context', async () => {
  const { client, service } = fixture({
    workload_tasks: [{ id: 1, title: 'Task', comments: 'Task note' }],
    performance_reviews: [{ id: 'review', review_period: '2026-Q3', comments: 'Manager note', employee_comments: '[acknowledged] Employee reply' }],
    performance_comments: [{ id: 'same-id', comment: ' Goal discussion ', author: 'Author', created_at: '2026-09-28', goal: { title: 'Goal', employee: { name: 'Owner' } } }],
    goal_check_ins: [{ id: 'same-id', note: ' Check-in progress ', goal: { title: 'Goal' }, employee: { name: 'Owner' } }],
  });
  const result = await service.fetchTranslatableRecords();
  assert.equal(result.success, true);
  for (const key of ['task:1:comments', 'review:review:comments', 'review:review:employee_comments', 'goal_comment:same-id:comment', 'goal_check_in:same-id:note']) {
    assert.ok(result.data.some(row => row.key === key), key);
  }
  const comment = result.data.find(row => row.entityType === 'goal_comment');
  assert.equal(comment.sourceText, 'Goal discussion');
  assert.equal(comment.recordLabel, 'Goal');
  assert.equal(comment.employeeName, 'Owner');
  assert.equal(comment.updatedAt, '2026-09-28');
  assert.equal(result.data.find(row => row.field === 'employee_comments').sourceText, 'Employee reply');
  const columns = client.calls.find(call => call.table === 'performance_comments' && call.method === 'select').args[0];
  assert.doesNotMatch(columns, /updated_at/);
  assert.ok(columns.includes('created_at'));
});

test('empty fields and acknowledgement-only reviews are not counted as translation work', async () => {
  const { service } = fixture({
    performance_reviews: [{ id: 'empty', employee_comments: ' [acknowledged] \n', comments: ' ' }],
    goal_check_ins: [{ id: 'blank', note: '  ' }],
  });
  const result = await service.fetchTranslatableRecords();
  assert.equal(result.success, true);
  assert.equal(result.data.length, 0);
});

test('source metadata fallback keeps all comments across pages', async () => {
  const comments = Array.from({ length: 601 }, (_, id) => ({ id, comment: `Note ${id}`, author: 'Author' }));
  const { service } = fixture({ performance_comments: comments }, {
    performance_comments: calls => calls.some(call => call.method === 'select' && call.args[0].includes('goal:'))
      ? { message: 'Relationship missing', code: 'PGRST200' } : null,
  }, { maxRows: 150 });
  const result = await service.fetchTranslatableRecords({ entityTypes: ['goal_comment'] });
  assert.equal(result.success, true);
  assert.equal(result.data.length, 601);
  assert.equal(result.data.at(-1).sourceText, 'Note 600');
});

test('an unreadable source fails the snapshot instead of understating its count', async () => {
  const { service } = fixture({ workload_tasks: [{ id: 1, title: 'Visible' }] }, {
    goal_check_ins: { code: '42P01', message: 'relation goal_check_ins does not exist' },
  });
  const result = await service.fetchTranslatableRecords();
  assert.equal(result.success, false);
  assert.match(result.error, /goal_check_ins/);
  assert.equal(result.data, undefined);
  assert.equal(service.isTranslationStoreAvailable(), true, 'a failed source is not a missing translation store');
});

test('coverage and locale lookups include every translation beyond server limits', async () => {
  const translations = Array.from({ length: 1507 }, (_, id) => ({
    entity_type: 'goal_check_in', entity_id: String(id), field: 'note', locale: 'en', body: `Translation ${id}`, source_text: `Source ${id}`,
  }));
  const { client, service } = fixture({ hr_ugc_translations: translations }, {}, { maxRows: 120 });
  const coverage = await service.fetchTranslationCoverage();
  const locale = await service.fetchLocaleTranslations('en');
  assert.equal(coverage.success, true);
  assert.equal(coverage.data.length, 1507);
  assert.equal(locale.success, true);
  assert.equal(locale.data.length, 1507);
  assert.equal(service.buildTranslationIndex(locale.data).byRecord.get('goal_check_in:1506:note'), 'Translation 1506');
  assert.ok(!client.calls.some(call => call.method === 'order' && call.args[0] === 'id'), 'translation table uses a composite key');
});

test('a failed coverage page cannot be mistaken for complete coverage', async () => {
  const translations = Array.from({ length: 601 }, (_, id) => ({ entity_type: 'task', entity_id: String(id), field: 'comments', locale: 'en', body: 'Saved' }));
  const { service } = fixture({ hr_ugc_translations: translations }, {
    hr_ugc_translations: calls => calls.some(call => call.method === 'range' && call.args[0] >= 500)
      ? { message: 'Read failed' } : null,
  });
  const result = await service.fetchTranslationCoverage();
  assert.equal(result.success, false);
  assert.equal(result.data, undefined);
});

test('every Studio source and field has a label in all supported languages', async () => {
  const { service } = fixture({});
  for (const locale of ['en', 'vn', 'de', 'fr', 'es', 'ru', 'jp', 'kr', 'th']) {
    const [{ default: base }, { default: additions }] = await Promise.all([
      import(`../src/translations/${locale}.js`), import(`../src/translations/additions/${locale}.js`),
    ]);
    const resolve = key => additions[key] || key.split('.').reduce((value, part) => value?.[part], base);
    for (const config of Object.values(service.TRANSLATABLE_ENTITIES)) {
      for (const key of [config.labelKey, ...config.fields.map(field => `translationStudio.field_${field}`)]) {
        assert.equal(typeof resolve(key), 'string', `${locale}: ${key}`);
      }
    }
  }
});
