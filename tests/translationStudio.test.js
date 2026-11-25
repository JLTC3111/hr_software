import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';
import { fetchAllRows } from '../src/utils/fetchAllRows.js';
import { isTranslationEditor } from '../src/utils/translationAccess.js';
import * as industry from '../src/theme/industry.js';
import english from '../src/translations/en.js';
import additions from '../src/translations/additions/en.js';

const services = (tables) => {
  const supabase = queryFixture(tables);
  const service = loadSource('src/services/ugcTranslationService.js', {
    '../config/supabaseClient': { supabase },
    '../utils/demoHelper': { isDemoMode: () => false },
    '../utils/fetchAllRows.js': { fetchAllRows },
  });
  const model = loadSource('src/utils/translationStudioQueue.js', { '../services/ugcTranslationService.js': service });
  return { service, model };
};

const locales = ['en', 'de', 'fr', 'jp', 'kr', 'th', 'vn', 'ru', 'es'];
const translation = (id, field, locale, body, source_text, entity_type = 'task') => ({
  entity_type, entity_id: String(id), field, locale, body, source_text,
});

test('coverage deduplicates supported languages and counts records separately from fields', async () => {
  const { service, model } = services({ workload_tasks: [
    { id: 1, title: 'First', description: 'Work' }, { id: 2, title: 'Second' }, { id: 3, title: ' ' },
  ], performance_goals: [{ id: 1, title: 'Independent source' }] });
  const { data } = await service.fetchTranslatableRecords();
  const saved = model.indexStudioTranslations([
    ...locales.map((locale) => translation(1, 'title', locale, 'Saved', 'First')),
    ...locales.map((locale) => translation(2, 'title', locale, 'Saved', locale === 'vn' ? 'Old source' : ' Second ')),
    translation(1, 'title', 'en', 'Duplicate slot', 'First'),
    translation(1, 'title', 'unsupported', 'Unknown locale', 'First'),
    translation(1, 'description', 'en', 'Saved', ''),
    translation(1, 'description', 'fr', '  ', 'Work'),
    translation(1, 'description', 'vi', 'Unsupported code', 'Work'),
    translation(4, 'title', 'en', 'Orphan translation', 'Missing record'),
  ], locales);
  const queue = model.buildStudioQueue([...data, data[0]], saved, [...locales, 'en']);

  const title = queue.fields.get('task:1:title');
  assert.equal(title.translatedCount, 9);
  assert.equal(title.localeCount, 9);
  assert.equal(title.missingLocales.length, 0);
  const description = queue.fields.get('task:1:description');
  assert.equal(description.translatedCount, 1);
  assert.ok(description.missingLocales.includes('vn'));
  assert.ok(description.missingLocales.includes('fr'));
  assert.equal(description.outdatedLocales.length, 0, 'a missing source snapshot is not evidence of an edit');
  assert.deepEqual([...queue.fields.get('task:2:title').outdatedLocales], ['vn']);
  assert.equal(queue.fields.size, 4);
  assert.equal(queue.missingCount, 2);
  assert.equal(queue.missingTranslationCount, 17);
  assert.equal(queue.outdatedCount, 1);
  assert.deepEqual({ ...queue.sources.get('task') }, { records: 2, completeRecords: 1, missingFields: 1, missingTranslations: 8, outdatedFields: 1 });
  assert.deepEqual({ ...queue.sources.get('goal') }, { records: 1, completeRecords: 0, missingFields: 1, missingTranslations: 9, outdatedFields: 0 });
});

test('the audited eight-target legacy coverage restores 48 of 49 records with one incomplete field', () => {
  const { model } = services({});
  const entries = [];
  const rows = [];
  const addRecord = (entityType, entityId, gaps) => {
    gaps.forEach((gap, i) => {
      const field = `field_${i}`;
      const sourceText = gap === 'vn' ? 'Bàn giao tài liệu' : gap === 'weak-vn' ? 'Kê khai' : 'Handover documentation';
      entries.push({ entityType, entityId, field, key: `${entityType}:${entityId}:${field}`, sourceText });
      if (gap === 'all') return;
      for (const locale of locales.filter((code) => code !== gap && !(gap === 'weak-vn' && code === 'vn'))) {
        rows.push(translation(entityId, field, locale, `Saved ${locale}`, sourceText, entityType));
      }
    });
    entries.push({ entityType, entityId, field: 'blank', key: `${entityType}:${entityId}:blank`, sourceText: ' \t\n ' });
  };
  let englishTasks = 19;
  for (let record = 0; record < 35; record += 1) {
    const gaps = Array.from({ length: record < 21 ? 3 : 2 }, (_, field) => {
      if (record === 0 || (record <= 6 && field === 0)) return null;
      if (record === 34 && field === 1) return 'all';
      if (record === 34) return 'weak-vn';
      if (englishTasks > 0) { englishTasks -= 1; return 'en'; }
      return 'vn';
    });
    addRecord('task', record, gaps);
  }
  for (let record = 0; record < 4; record += 1) addRecord('goal', record, ['en', 'vn']);
  addRecord('goal_check_in', 0, ['en']);
  addRecord('review', 0, ['en', 'en', 'en', 'en']);
  for (let record = 0; record < 8; record += 1) addRecord('leave', record, [record < 2 ? 'en' : 'vn']);

  const saved = model.indexStudioTranslations(rows, locales);
  const queue = model.buildStudioQueue(entries, saved, locales);
  const strictMissing = [...queue.fields.keys()].filter((key) => saved.get(key)?.size !== locales.length);
  const strictIncomplete = new Set(strictMissing.map((key) => {
    const { entityType, entityId } = queue.fields.get(key);
    return `${entityType}:${entityId}`;
  }));
  assert.equal(rows.length, 897);
  assert.equal(queue.fields.size, 112);
  assert.equal(strictMissing.length, 103);
  assert.equal(49 - strictIncomplete.size, 1);
  assert.equal(queue.missingCount, 1);
  for (const [type, complete, records] of [['task', 34, 35], ['goal', 4, 4], ['goal_check_in', 1, 1], ['review', 1, 1], ['leave', 8, 8]]) {
    assert.equal(queue.sources.get(type).completeRecords, complete);
    assert.equal(queue.sources.get(type).records, records);
  }
  assert.equal(queue.fields.get('task:34:field_0').localeCount, 8, 'an original language does not require a saved copy');
  assert.equal(queue.fields.get('task:34:field_0').translatedCount, 8);
  assert.equal(queue.fields.get('task:34:field_1').translatedCount, 0);
});

test('a known original is excluded even when saved, while real target gaps stay filterable', () => {
  const { model } = services({});
  const key = 'task:1:title';
  const text = 'Đổi lịch họp';
  const saved = model.indexStudioTranslations(locales.filter((locale) => !['en', 'fr'].includes(locale))
    .map((locale) => translation(1, 'title', locale, 'Saved', text)), locales);
  const queue = model.buildStudioQueue([{ key, entityType: 'task', entityId: '1', field: 'title', sourceText: text }], saved, locales);
  const entry = queue.fields.get(key);
  assert.equal(entry.originalLocale, 'vn');
  assert.equal(entry.localeCount, 8);
  assert.equal(entry.translatedCount, 6);
  assert.deepEqual([...entry.missingLocales], ['en', 'fr']);
  assert.equal(queue.missingCount, 1);
  assert.equal(queue.missingTranslationCount, 2);
  const filters = { status: 'missing', sources: new Set(['task']), fields: new Set(['task:title']) };
  assert.equal(model.filterStudioQueue([entry], { ...filters, language: 'vn' }).length, 0);
  assert.equal(model.filterStudioQueue([entry], { ...filters, language: 'fr' }).length, 1);
});

test('an exact saved parent title finds related notes even when the goal source is filtered out', async () => {
  const { service, model } = services({
    performance_goals: [{ id: 42, title: 'Phát triển' }],
    performance_comments: [{ id: 1, goal_id: 42, goal: { title: 'Phát triển' }, comment: 'Nhận xét' }],
  });
  const { data } = await service.fetchTranslatableRecords();
  const saved = model.indexStudioTranslations([translation(42, 'title', 'en', 'Development', 'Phát triển', 'goal')], locales);
  const queue = model.buildStudioQueue(data, saved, locales);
  const matches = model.searchStudioQueue(queue.fields, saved, 'DEVELOPMENT');
  assert.deepEqual(Array.from(matches, ({ key }) => key), ['goal:42:title', 'goal_comment:1:comment']);
  const visible = model.filterStudioQueue(matches, {
    status: 'missing', sources: new Set(['goal_comment']), fields: new Set(['goal_comment:comment']), language: 'fr',
  });
  assert.deepEqual(Array.from(visible, ({ key }) => key), ['goal_comment:1:comment']);
});

test('search finds titles shown through manual text reuse and respects exact overrides and conflicts', async () => {
  const { service, model } = services({ workload_tasks: [
    { id: 1, title: 'Bàn giao' }, { id: 2, title: 'Bàn giao', description: 'Status notes' }, { id: 3, title: 'Bàn giao' },
  ] });
  const { data } = await service.fetchTranslatableRecords();
  const matches = (rows) => {
    const saved = model.indexStudioTranslations(rows, locales);
    const { fields } = model.buildStudioQueue(data, saved, locales);
    return Array.from(model.searchStudioQueue(fields, saved, 'HANDOVER'), ({ key }) => key);
  };
  const shared = translation(1, 'title', 'en', 'Handover', 'Bàn giao');
  assert.deepEqual(matches([shared]), ['task:1:title', 'task:2:title', 'task:2:description', 'task:3:title']);
  assert.deepEqual(matches([shared, translation(3, 'title', 'en', 'Transfer', 'Bàn giao')]), ['task:1:title']);
});

function studio({ role = 'admin', saveError = false, fetchError = false, machine = false, legacy = false, deferRefresh = false } = {}) {
  const records = legacy ? [{ id: 1, title: 'Legacy English source', description: ' ' }] : [
    { id: 1, title: 'Open task', description: 'Description to translate.' },
    { id: 2, title: 'Complete task' },
    { id: 3, title: 'Old task' },
  ];
  const saved = legacy ? locales.filter((locale) => locale !== 'en')
    .map((locale) => translation(1, 'title', locale, `Saved ${locale}`, 'Legacy English source')) : [
    ...locales.filter((locale) => locale !== 'fr').map((locale) => translation(1, 'title', locale, 'Saved', 'Open task')),
    ...locales.map((locale) => translation(2, 'title', locale, locale === 'fr' ? 'État final' : 'Saved', 'Complete task')),
    ...locales.map((locale) => translation(3, 'title', locale, 'Saved', locale === 'fr' ? 'Former source' : 'Old task')),
  ];
  const { service, model } = services({
    workload_tasks: records, performance_goals: legacy ? [] : [{ id: 7, title: 'Goal without translations' }], hr_ugc_translations: saved,
  });
  let releaseRefresh;
  const refreshing = deferRefresh ? new Promise((resolve) => { releaseRefresh = resolve; }) : null;
  const calls = { saves: [], selected: [], focus: [], published: [], queues: 0, reinstall: 0 };
  const translate = (key, fallback) => additions[key] || key.split('.').reduce((value, part) => value?.[part], english) || fallback;
  const hooks = [];
  let effects = [];
  let cursor = 0;
  let changed = false;
  let tree;
  const sameDeps = (before, after) => before && after && before.length === after.length && after.every((value, i) => Object.is(value, before[i]));
  const memo = (fn, deps) => {
    const i = cursor++;
    if (!sameDeps(hooks[i]?.deps, deps)) hooks[i] = { value: fn(), deps };
    return hooks[i].value;
  };
  const react = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const i = cursor++;
      hooks[i] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[i].value, (next) => {
        const value = typeof next === 'function' ? next(hooks[i].value) : next;
        if (!Object.is(value, hooks[i].value)) changed = true;
        hooks[i].value = value;
      }];
    },
    useRef(initial) { return hooks[cursor++] ||= { current: initial }; },
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const i = cursor++;
      if (sameDeps(hooks[i]?.deps, deps)) return;
      effects.push(() => {
        hooks[i]?.cleanup?.();
        hooks[i] = { deps, cleanup: fn() };
      });
    },
  };
  const supported = Object.fromEntries(locales.map((code) => [code, { code, name: code === 'fr' ? 'Français' : code }]));
  const ui = Object.fromEntries(['Blueprint', 'Tag', 'Btn', 'Kicker', 'ColumnHeading', 'TickerCell', 'LiveClock'].map((name) => [name, name]));
  const { default: Studio } = loadSource('src/components/translationStudio.jsx', {
    react, 'lucide-react': {},
    '../contexts/LanguageContext': { useLanguage: () => ({ t: translate, currentLanguage: 'en' }), SUPPORTED_LANGUAGES: supported },
    '../contexts/ThemeContext': { useTheme: () => ({ isDarkMode: true }) },
    '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'editor', role } }) },
    '../utils/demoHelper': { isDemoMode: () => false },
    '../utils/translationAccess': { isTranslationEditor },
    '../utils/translationQueueStatus.js': { publishTranslationQueueCount: (_user, count) => calls.published.push(count) },
    '../utils/translationStudioQueue.js': model,
    '../theme/industry.js': industry,
    './ui/industry.jsx': ui,
    './ui/shiny-button': { ShinyButton: 'ShinyButton' },
    './ui/fetch-elapsed-pill': { FetchElapsedPill: 'fetching' },
    '../services/ugcTranslationService': {
      ...service,
      fetchTranslatableRecords: () => { calls.queues += 1; return service.fetchTranslatableRecords(); },
      fetchRecordTranslations: (type, id) => {
        calls.selected.push(id);
        return fetchError ? Promise.resolve({ success: false }) : service.fetchRecordTranslations(type, id);
      },
      fetchLocaleTranslations: async (locale) => {
        await refreshing;
        return service.fetchLocaleTranslations(locale);
      },
      saveTranslationBatch: async (entries) => {
        calls.saves.push(...entries);
        if (saveError) return { success: false, error: 'Write failed' };
        for (const entry of entries) {
          saved.push(translation(entry.entityId, entry.field, entry.locale, entry.body, entry.sourceText, entry.entityType));
        }
        return { success: true };
      },
      deleteTranslation: async ({ entityType, entityId, field, locale }) => {
        const index = saved.findIndex((row) => row.entity_type === entityType && row.entity_id === entityId
          && row.field === field && row.locale === locale);
        if (index >= 0) saved.splice(index, 1);
        return { success: true };
      },
    },
    '../services/translateService': {
      isLocalTranslationSupported: () => machine,
      translationAvailability: async () => 'available',
      prepareTranslation: async () => {},
      translateText: async (_source, locale) => `Machine draft ${locale}`,
      setManualTranslations: () => { calls.reinstall += 1; },
    },
  }, { React: react, setTimeout() {}, clearTimeout() {} });

  const findAll = (node, fn) => {
    if (node == null || typeof node !== 'object') return [];
    return [...(fn(node) ? [node] : []), ...(Array.isArray(node) ? node : node.children).flatMap((child) => findAll(child, fn))];
  };
  const text = (node) => Array.isArray(node) ? node.map(text).join('') : node?.children ? text(node.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  const flush = async () => {
    do {
      cursor = 0;
      changed = false;
      effects = [];
      tree = Studio();
      for (const node of findAll(tree, ({ props }) => props?.ref && props.id)) {
        if (typeof node.props.ref === 'function') {
          node.props.ref({ focus: () => calls.focus.push(node.props.id), scrollIntoView() {} });
        }
      }
      effects.forEach((effect) => effect());
      await setImmediate();
    } while (changed);
  };
  return {
    calls, flush, releaseRefresh,
    find: (fn) => findAll(tree, fn)[0],
    button: (label) => findAll(tree, ({ type, props, children }) => ['Btn', 'button', 'ShinyButton'].includes(type)
      && (props?.['aria-label'] === label || text(children) === label))[0],
    inputs: () => findAll(tree, ({ type }) => type === 'textarea').map(({ props }) => props.id),
    text: () => text(tree),
  };
}

test('the default queue and independent filters expose missing work and explain hidden exact search matches', async () => {
  const screen = studio();
  await screen.flush();
  assert.equal(screen.button('Missing').props['aria-pressed'], true);
  assert.equal(screen.calls.published.at(-1), 3);
  assert.equal(screen.find(({ props }) => props?.label === 'Missing translations').props.value, 19);
  assert.equal(screen.find(({ type }) => type === 'details').props.open, undefined);
  assert.equal(screen.calls.selected.length, 0);
  assert.match(screen.text(), /Open task/);
  assert.doesNotMatch(screen.text(), /Complete task|Old task/);
  assert.ok(screen.find(({ props }) => props?.className?.includes('line-clamp-3')));

  const language = () => screen.find(({ type }) => type === 'select');
  language().props.onChange({ target: { value: 'en' } });
  screen.button('Partial').props.onClick();
  await screen.flush();
  assert.match(screen.text(), /Nothing matches/);
  language().props.onChange({ target: { value: 'fr' } });
  await screen.flush();
  assert.match(screen.text(), /Open task/);
  assert.doesNotMatch(screen.text(), /Description to translate|Goal without translations/);

  const search = () => screen.find(({ props }) => props?.type === 'search');
  search().props.onChange({ target: { value: '  ETAT   FINAL  ' } });
  await screen.flush();
  assert.ok(screen.button('Show all 1 matching fields'));
  screen.button('Show all 1 matching fields').props.onClick();
  await screen.flush();
  assert.equal(search().props.value, '  ETAT   FINAL  ');
  assert.equal(screen.button('All').props['aria-pressed'], true);
  assert.match(screen.text(), /Complete task/);

  const tasks = screen.find(({ props, children }) => props?.['aria-controls'] === 'translation-studio-queue'
    && children?.[0]?.children?.[0] === 'Tasks');
  tasks.props.onClick();
  await screen.flush();
  assert.equal(search().props.value, '');
  assert.equal(screen.button('Missing').props['aria-pressed'], true);
  assert.match(screen.text(), /Description to translate/);
  assert.doesNotMatch(screen.text(), /Goal without translations/);

  screen.button('Description (1)').props.onClick();
  await screen.flush();
  assert.doesNotMatch(screen.text(), /Description to translate/);
  screen.button('Reset all').props.onClick();
  await screen.flush();
  assert.match(screen.text(), /Description to translate|Goal without translations/);

  screen.button('Complete').props.onClick();
  await screen.flush();
  assert.match(screen.text(), /Complete task/);
  assert.doesNotMatch(screen.text(), /Open task/);
  screen.button('Out of date').props.onClick();
  await screen.flush();
  assert.match(screen.text(), /Old task/);
  assert.doesNotMatch(screen.text(), /Complete task/);
  language().props.onChange({ target: { value: 'en' } });
  await screen.flush();
  assert.doesNotMatch(screen.text(), /Old task/);
  language().props.onChange({ target: { value: 'fr' } });
  await screen.flush();
  assert.ok(screen.button('Français · Out of date'));
});

test('language preview focuses the existing input and Save & Next Missing updates coverage and advances', async () => {
  const screen = studio();
  await screen.flush();
  screen.find(({ type }) => type === 'select').props.onChange({ target: { value: 'fr' } });
  await screen.flush();
  screen.button('Français · Missing').props.onClick();
  await screen.flush();
  assert.equal(screen.calls.focus.at(-1), 'tr-fr');
  assert.equal(screen.inputs().length, locales.length);
  screen.find(({ props }) => props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  await screen.flush();
  assert.deepEqual(screen.inputs(), ['tr-fr']);
  screen.find(({ props }) => props?.id === 'tr-fr').props.onChange({ target: { value: 'Tâche ouverte' } });
  await screen.flush();
  await screen.button('Save & Next Missing').props.onClick();
  await screen.flush();

  assert.equal(screen.calls.saves.length, 1);
  assert.equal(screen.calls.saves[0].field, 'title');
  assert.equal(screen.calls.saves[0].locale, 'fr');
  assert.equal(screen.calls.saves[0].sourceText, 'Open task');
  assert.equal(screen.calls.reinstall, 1);
  assert.deepEqual(screen.calls.selected, ['1', '1'], 'the next field belongs to the same record');
  assert.equal(screen.calls.focus.at(-1), 'tr-fr');
  assert.equal(screen.find(({ props }) => props?.id === 'tr-fr').props.placeholder, 'Description to translate.');
  assert.equal(screen.calls.published.at(-1), 2);
  assert.match(screen.text(), /Fields to translate \(1\)/);
  assert.equal(screen.calls.queues, 1, 'coverage updates without reloading the source tables');
});

test('existing automatic suggestions and ordinary Save retain manual overrides and update the selected coverage', async () => {
  const screen = studio({ machine: true });
  await screen.flush();
  screen.button('Français · Missing').props.onClick();
  await screen.flush();
  await screen.button('Suggest all empty').props.onClick();
  await screen.flush();
  const input = (locale) => screen.find(({ props }) => props?.id === `tr-${locale}`);
  assert.equal(input('en').props.value, 'Saved');
  assert.equal(input('fr').props.value, 'Machine draft fr');
  assert.equal(screen.calls.saves.length, 0);
  input('fr').props.onChange({ target: { value: 'Révisé' } });
  await screen.flush();
  await screen.button('Save (1)').props.onClick();
  await screen.flush();
  assert.equal(input('fr').props.value, 'Révisé');
  assert.equal(screen.calls.saves[0].body, 'Révisé');
  assert.deepEqual(screen.calls.selected, ['1']);
  assert.equal(screen.find(({ props }) => props?.label === 'Selected').props.value, '9/9');
  assert.equal(screen.calls.published.at(-1), 2);
});

test('deleting and restoring one target updates the field, source, and sidebar counts as soon as the write succeeds', async () => {
  const screen = studio({ legacy: true, deferRefresh: true });
  const count = (label) => screen.find(({ props }) => props?.label === label).props.value;
  await screen.flush();
  assert.equal(count('Incomplete fields'), 0);
  assert.deepEqual(screen.calls.published, [0]);
  assert.match(screen.text(), /1 of 1 records complete/);

  screen.button('Complete').props.onClick();
  await screen.flush();
  screen.find(({ props }) => props && Object.hasOwn(props, 'aria-current')).props.onClick();
  await screen.flush();
  assert.equal(count('Selected'), '8/8');
  const remove = screen.button('Remove').props.onClick();
  await screen.flush();
  assert.equal(screen.calls.reinstall, 0, 'the locale index refresh is still pending');
  assert.equal(count('Selected'), '7/8');
  assert.equal(count('Incomplete fields'), 1);
  assert.equal(count('Missing translations'), 1);
  assert.deepEqual(screen.calls.published, [0, 1]);
  assert.match(screen.text(), /0 of 1 records complete/);
  screen.releaseRefresh();
  await remove;
  await screen.flush();

  screen.button('Refresh').props.onClick();
  await screen.flush();
  screen.button('Missing').props.onClick();
  await screen.flush();
  assert.ok(screen.button('de · Missing'));
  assert.equal(screen.button('en · Missing'), undefined, 'the original language is not a target');
  screen.find(({ props }) => props?.type === 'checkbox').props.onChange({ target: { checked: true } });
  await screen.flush();
  assert.deepEqual(screen.inputs(), ['tr-de']);

  screen.find(({ props }) => props?.id === 'tr-de').props.onChange({ target: { value: 'Ersatz' } });
  await screen.flush();
  await screen.button('Save (1)').props.onClick();
  await screen.flush();
  assert.equal(count('Selected'), '8/8');
  assert.equal(count('Missing translations'), 0);
  assert.equal(screen.calls.published.at(-1), 0);
  assert.match(screen.text(), /1 of 1 records complete/);
});

test('a deletion from a complete field does not turn the removed target into an inferred original', async () => {
  const screen = studio();
  await screen.flush();
  screen.button('Complete').props.onClick();
  await screen.flush();
  screen.find(({ props }) => props && Object.hasOwn(props, 'aria-current')).props.onClick();
  await screen.flush();
  await screen.button('Remove').props.onClick();
  await screen.flush();
  assert.equal(screen.find(({ props }) => props?.label === 'Selected').props.value, '8/9');
  assert.equal(screen.calls.published.at(-1), 4);
  screen.button('Missing').props.onClick();
  await screen.flush();
  assert.match(screen.text(), /Complete task/);
});

test('a failed write keeps the draft in place and leaves coverage and navigation unchanged', async () => {
  const screen = studio({ saveError: true });
  await screen.flush();
  screen.button('Français · Missing').props.onClick();
  await screen.flush();
  screen.find(({ props }) => props?.id === 'tr-fr').props.onChange({ target: { value: 'Brouillon' } });
  await screen.flush();
  await screen.button('Save & Next Missing').props.onClick();
  await screen.flush();
  assert.deepEqual(screen.calls.selected, ['1']);
  assert.equal(screen.calls.published.at(-1), 3);
  assert.equal(screen.find(({ props }) => props?.id === 'tr-fr').props.value, 'Brouillon');
  assert.match(screen.text(), /Could not save/);
});

test('an editor read error leaves the queue available and unauthorized users never load it', async () => {
  const screen = studio({ fetchError: true });
  await screen.flush();
  screen.button('Français · Missing').props.onClick();
  await screen.flush();
  assert.match(screen.text(), /Could not load translatable content/);
  assert.ok(screen.button('Français · Missing'));
  assert.equal(screen.inputs().length, 0);

  const restricted = studio({ role: 'employee' });
  await restricted.flush();
  assert.equal(restricted.calls.queues, 0);
  assert.match(restricted.text(), /Access Denied/);
});
