import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['en', 'de', 'fr', 'es', 'jp', 'kr', 'th', 'vn', 'ru'];

const loadCatalogs = async () => Object.fromEntries(await Promise.all(
  LOCALES.map(async (locale) => {
    const [{ default: base }, { default: additions }] = await Promise.all([
      import(`../src/translations/${locale}.js`),
      import(`../src/translations/additions/${locale}.js`),
    ]);
    return [locale, { base, additions }];
  })
));

const resolveKey = ({ base, additions }, key) => {
  if (Object.prototype.hasOwnProperty.call(additions, key)) return additions[key];
  let value = base;
  for (const part of key.split('.')) value = value?.[part];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const sourceFiles = () => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'translations') continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) files.push(filename);
    }
  };
  visit(path.join(ROOT, 'src'));
  return files;
};

const staticTranslationCalls = () => {
  const calls = new Map();
  const pattern = /\b(?:t|message)\(\s*(['"`])([^'"`$]+)\1/g;
  for (const filename of sourceFiles()) {
    const source = fs.readFileSync(filename, 'utf8');
    for (const match of source.matchAll(pattern)) {
      const key = match[2];
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(path.relative(ROOT, filename));
    }
  }
  return calls;
};

const placeholderTokens = (value) => (
  [...String(value).matchAll(/\{+\w+\}+/g)].map((match) => match[0]).sort()
);

const DYNAMIC_KEYS = [
  'employeeStatus.onleave',
  'personalGoals.technicalSkills',
  'policyControls.audit.overtimeCapChanged',
  'policyControls.audit.lateGraceChanged',
  'policyControls.audit.teamLeadLeaveGranted',
  'policyControls.audit.reviewCycleOpened',
  'recruitment.statuses.interviewscheduled',
  'recruitment.statuses.underreview',
  'recruitment.statuses.offerextended',
  'recruitment.statuses.hired',
  'recruitment.statuses.rejected',
  'recruitment.statuses.shortlisted',
  'recruitment.statuses.pending',
  'timeTracking.statuses.pending',
  'timeTracking.statuses.approved',
  'timeTracking.statuses.rejected',
  'timeTracking.statuses.cancelled',
];

test('every static component translation key resolves in every supported locale', async () => {
  const catalogs = await loadCatalogs();
  const calls = staticTranslationCalls();
  const failures = [];

  for (const [key, files] of calls) {
    for (const locale of LOCALES) {
      if (!resolveKey(catalogs[locale], key)) {
        failures.push(`${locale}: ${key} (${[...new Set(files)].join(', ')})`);
      }
    }
  }

  assert.deepEqual(failures, [], `Missing translations:\n${failures.join('\n')}`);
});

test('known dynamic translation keys resolve in every supported locale', async () => {
  const catalogs = await loadCatalogs();
  const failures = [];
  for (const key of DYNAMIC_KEYS) {
    for (const locale of LOCALES) {
      if (!resolveKey(catalogs[locale], key)) failures.push(`${locale}: ${key}`);
    }
  }
  assert.deepEqual(failures, [], `Missing dynamic translations:\n${failures.join('\n')}`);
});

test('translated placeholders match the English component contract', async () => {
  const catalogs = await loadCatalogs();
  const keys = new Set([...staticTranslationCalls().keys(), ...DYNAMIC_KEYS]);
  const failures = [];

  for (const key of keys) {
    const english = resolveKey(catalogs.en, key);
    if (!english) continue;
    const expected = placeholderTokens(english);
    for (const locale of LOCALES.slice(1)) {
      const translated = resolveKey(catalogs[locale], key);
      if (translated && placeholderTokens(translated).join('|') !== expected.join('|')) {
        failures.push(`${locale}: ${key} expected [${expected}] received [${placeholderTokens(translated)}]`);
      }
    }
  }

  assert.deepEqual(failures, [], `Placeholder mismatches:\n${failures.join('\n')}`);
});

test('Punch Clock and Policy Controls do not silently reuse the English catalog', async () => {
  const catalogs = await loadCatalogs();
  const calls = [...staticTranslationCalls().keys()];
  const featureKeys = calls.filter((key) => (
    key.startsWith('punchClock.') || key.startsWith('policyControls.')
  ));

  for (const locale of LOCALES.slice(1)) {
    const unchanged = featureKeys.filter((key) => (
      resolveKey(catalogs[locale], key) === resolveKey(catalogs.en, key)
    ));
    assert.ok(
      unchanged.length < featureKeys.length * 0.25,
      `${locale} still renders ${unchanged.length}/${featureKeys.length} Punch Clock/Policy strings in English`
    );
  }
});
