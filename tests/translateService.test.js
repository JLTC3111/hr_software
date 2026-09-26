import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { loadSource } from './helpers/loadSource.js';

function translatorFixture({ fail = false } = {}) {
  const gate = Promise.withResolvers();
  const detections = [], translations = [];
  const service = loadSource('src/services/translateService.js', {
    '../utils/demoHelper': { isDemoMode: () => false },
  }, {
    Map,
    LanguageDetector: { create: async () => ({ detect: async text => {
      detections.push(text);
      return [{ detectedLanguage: 'vi', confidence: 1 }];
    } }) },
    Translator: {
      availability: async () => 'available',
      create: async ({ targetLanguage }) => ({ translate: async text => {
        translations.push({ text, targetLanguage });
        await gate.promise;
        if (fail) throw new Error('Model temporarily unavailable');
        return `${targetLanguage}:${text}`;
      } }),
    },
  });
  return { service, gate, detections, translations };
}

test('report preparation and export share in-flight detection and translation, then reuse cached text', async () => {
  const { service, gate, detections, translations } = translatorFixture();
  const preparation = service.translateTexts(['One', 'Two'], 'en');
  await setImmediate();
  const exporting = service.translateTexts(['One', 'Two'], 'en');
  await setImmediate();
  assert.deepEqual(detections, ['One']);
  assert.equal(translations.length, 1);
  gate.resolve();
  const [prepared, exported] = await Promise.all([preparation, exporting]);
  assert.deepEqual(Array.from(prepared), ['en:One', 'en:Two']);
  assert.deepEqual(Array.from(exported), ['en:One', 'en:Two']);
  await service.translateTexts(['Two', 'One'], 'en');
  assert.deepEqual(detections, ['One', 'Two']);
  assert.equal(translations.length, 2);
});

test('changing the report cancels obsolete preparation without interrupting an active export', async () => {
  const { service, gate, translations } = translatorFixture();
  const controller = new AbortController();
  const preparation = service.translateTexts(['One', 'Unused'], 'en', { signal: controller.signal });
  await setImmediate();
  const exporting = service.translateTexts(['One', 'Needed'], 'en');
  controller.abort();
  gate.resolve();
  await Promise.all([preparation, exporting]);
  assert.deepEqual(translations.map(row => row.text), ['One', 'Needed']);
});

test('in-flight translations remain separated by language and manual overrides take precedence', async () => {
  const { service, gate, translations } = translatorFixture();
  const english = service.translateText('One', 'en');
  const german = service.translateText('One', 'de');
  await setImmediate();
  assert.equal(translations.length, 2);
  service.setManualTranslations('en', { byText: new Map([['One', 'Human translation']]) });
  assert.equal(await service.translateText('One', 'en'), 'Human translation');
  gate.resolve();
  assert.equal(await english, 'en:One');
  assert.equal(await german, 'de:One');
  assert.equal(await service.translateText('One', 'en'), 'Human translation');
});

test('failed background translations return original text and remain retryable on export', async () => {
  const { service, gate, translations } = translatorFixture({ fail: true });
  gate.resolve();
  assert.equal(await service.translateText('One', 'en'), 'One');
  assert.equal(await service.translateText('One', 'en'), 'One');
  assert.equal(translations.length, 2);
});
