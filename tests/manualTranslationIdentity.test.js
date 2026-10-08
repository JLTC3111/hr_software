import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers/loadSource.js';

test('translation loader clears old reader data and discards a late response after logout', async () => {
  const effects = [], installed = [];
  let resolve;
  const { default: Loader } = loadSource('src/contexts/ManualTranslationLoader.jsx', {
    react: { useEffect: effect => effects.push(effect) },
    './AuthContext.jsx': { useAuth: () => ({ isAuthenticated: true, user: { id: 'admin', role: 'admin' }, session: { user: { id: 'auth-admin' } } }) },
    './LanguageContext.jsx': { useLanguage: () => ({ currentLanguage: 'en', manualTranslationsVersion: 0 }) },
    '../services/translateService.js': { setManualTranslations: (locale, index) => installed.push([locale, index]) },
    '../services/ugcTranslationService.js': { buildTranslationIndex: rows => rows, fetchLocaleTranslations: () => new Promise(done => { resolve = done; }) },
  });
  Loader();
  const cleanup = effects[0]();
  assert.deepEqual(installed, [['en', null]]);
  cleanup();
  resolve({ success: true, data: [{ body: 'Private admin wording' }] });
  await Promise.resolve();
  assert.deepEqual(installed, [['en', null], [null, null]]);
});

test('signed-out translation loader never fetches authenticated records', () => {
  let effect, reads = 0;
  const { default: Loader } = loadSource('src/contexts/ManualTranslationLoader.jsx', {
    react: { useEffect: fn => { effect = fn; } },
    './AuthContext.jsx': { useAuth: () => ({ isAuthenticated: false, user: null }) },
    './LanguageContext.jsx': { useLanguage: () => ({ currentLanguage: 'en', manualTranslationsVersion: 0 }) },
    '../services/translateService.js': { setManualTranslations() {} },
    '../services/ugcTranslationService.js': { fetchLocaleTranslations: () => { reads++; } },
  });
  Loader(); effect();
  assert.equal(reads, 0);
});
