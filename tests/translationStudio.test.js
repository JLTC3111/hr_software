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
  assert.equal(queue.outdatedCount, 1);
  assert.deepEqual({ ...queue.sources.get('task') }, { records: 2, completeRecords: 1, missingFields: 1, outdatedFields: 1 });
  assert.deepEqual({ ...queue.sources.get('goal') }, { records: 1, completeRecords: 0, missingFields: 1, outdatedFields: 0 });
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

function studio({ role = 'admin', saveError = false, fetchError = false, machine = false } = {}) {
  const records = [
    { id: 1, title: 'Open task', description: 'Description to translate.' },
    { id: 2, title: 'Complete task' },
    { id: 3, title: 'Old task' },
  ];
  const saved = [
    ...locales.filter((locale) => locale !== 'fr').map((locale) => translation(1, 'title', locale, 'Saved', 'Open task')),
    ...locales.map((locale) => translation(2, 'title', locale, locale === 'fr' ? 'État final' : 'Saved', 'Complete task')),
    ...locales.map((locale) => translation(3, 'title', locale, 'Saved', locale === 'fr' ? 'Former source' : 'Old task')),
  ];
  const { service, model } = services({
    workload_tasks: records, performance_goals: [{ id: 7, title: 'Goal without translations' }], hr_ugc_translations: saved,
  });
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
      saveTranslationBatch: async (entries) => {
        calls.saves.push(...entries);
        if (saveError) return { success: false, error: 'Write failed' };
        for (const entry of entries) {
          saved.push(translation(entry.entityId, entry.field, entry.locale, entry.body, entry.sourceText, entry.entityType));
        }
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
    calls, flush,
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
