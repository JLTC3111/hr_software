import { isDemoMode } from '../utils/demoHelper';

/**
 * On-device UGC translation using the browser's built-in Translator API
 * (Chromium 138+). Models run locally inside the browser: no network calls,
 * no API keys, no per-character cost, and nothing leaves the machine.
 *
 * Where the API is missing (Safari, Firefox, older Chrome) or a language pack
 * is unavailable, every entry point resolves to the original text — callers
 * render UGC as written, which is the no-translation behaviour.
 */

const CACHE_KEY = 'hr-translate-cache-v3';
const CACHE_MAX = 500;

/** App UI language → BCP-47 codes understood by the Translator API. */
export const TRANSLATE_LANG_MAP = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
  jp: 'ja',
  kr: 'ko',
  th: 'th',
  vn: 'vi',
  ru: 'ru',
};

const memoryCache = new Map();

/**
 * Hand-authored translations loaded from Supabase (see ugcTranslationService).
 *
 * These outrank everything else: a human wrote them, they are shared across all
 * readers, and they survive a cache clear. The on-device model is only ever
 * consulted for strings nobody has translated by hand.
 */
let manualIndex = { byRecord: new Map(), byText: new Map() };
let manualLocale = null;

/**
 * Installs the manual overrides for one app language. Called by
 * LanguageProvider on mount and on every language switch; also called by the
 * Translation Studio after a save so the change is visible app-wide without a
 * reload.
 */
export function setManualTranslations(appLang, index) {
  manualLocale = appLang || null;
  manualIndex = {
    byRecord: index?.byRecord instanceof Map ? index.byRecord : new Map(),
    byText: index?.byText instanceof Map ? index.byText : new Map(),
  };
  // Anything already on screen rendered against the old index (or none at all).
  notifyTranslatorReady();
}

export function clearManualTranslations() {
  setManualTranslations(null, null);
}

/**
 * Synchronous manual-override lookup.
 *
 * `record` narrows the search to one field of one row, which is the only way to
 * disambiguate two records that share wording but not meaning. Without it the
 * text index still applies, but only where every author agreed on the same
 * translation — buildTranslationIndex() drops contested strings.
 */
export function peekManualTranslation(text, appLang, record = null) {
  if (!appLang || appLang !== manualLocale) return null;

  if (record?.entityType && record?.entityId != null && record?.field) {
    const hit = manualIndex.byRecord.get(
      `${record.entityType}:${record.entityId}:${record.field}`
    );
    if (hit) return hit;
  }

  const source = (text == null ? '' : String(text)).trim();
  if (!source) return null;
  // `null` is the marker for a string with conflicting translations.
  return manualIndex.byText.get(source) || null;
}

function hashText(text) {
  // Fast non-crypto hash for cache keys
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function cacheKey(text, targetLang) {
  return `${targetLang}:${hashText(text)}:${text.length}`;
}

function loadPersistedCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    Object.entries(obj).forEach(([k, v]) => {
      if (typeof v === 'string') memoryCache.set(k, v);
    });
  } catch {
    /* ignore corrupt cache */
  }
}

function persistCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    const entries = [...memoryCache.entries()].slice(-CACHE_MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota / private mode */
  }
}

let cacheHydrated = false;
function ensureCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  loadPersistedCache();
}

function setCache(key, value) {
  memoryCache.set(key, value);
  if (memoryCache.size > CACHE_MAX) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
  persistCache();
}

/** Chromium exposes these as globals on secure origins (localhost counts). */
const hasTranslator = () => Boolean(getTranslatorApi());
const hasDetector = () => Boolean(getDetectorApi());

/**
 * The API graduated from the origin-trial `self.ai.translator` shape to the
 * `Translator` / `LanguageDetector` globals. Supporting both keeps the feature
 * alive across Chrome versions instead of going dark on one of them.
 */
function getTranslatorApi() {
  if (typeof globalThis === 'undefined') return null;
  if (typeof globalThis.Translator?.create === 'function') return globalThis.Translator;
  const legacy = globalThis.ai?.translator;
  return typeof legacy?.create === 'function' ? legacy : null;
}

function getDetectorApi() {
  if (typeof globalThis === 'undefined') return null;
  if (typeof globalThis.LanguageDetector?.create === 'function') return globalThis.LanguageDetector;
  const legacy = globalThis.ai?.languageDetector;
  return typeof legacy?.create === 'function' ? legacy : null;
}

export const isLocalTranslationSupported = () => hasTranslator();

let detectorPromise = null;
const getDetector = () => {
  const api = getDetectorApi();
  if (!api) return Promise.resolve(null);
  if (!detectorPromise) {
    detectorPromise = api.create().catch((error) => {
      console.warn('Language detector unavailable:', error?.message || error);
      return null;
    });
  }
  return detectorPromise;
};

/**
 * Best-effort source language.
 *
 * The confidence bar is deliberately low: short UGC like "Fix login bug" is
 * inherently ambiguous and the detector reports it with far less confidence
 * than the same length of Vietnamese, whose diacritics are unmistakable. A high
 * bar therefore rejects English titles while passing Vietnamese ones. Guessing
 * slightly wrong is cheap — the pair is either unsupported (we keep the
 * original) or close enough to translate.
 */
const MIN_DETECT_CONFIDENCE = 0.15;

const detectLanguage = async (text) => {
  const detector = await getDetector();
  if (!detector) return null;
  try {
    const results = await detector.detect(text);
    const best = (results || []).find(
      (r) => r?.detectedLanguage && r.detectedLanguage !== 'und'
    );
    if (!best || best.confidence < MIN_DETECT_CONFIDENCE) return null;
    return best.detectedLanguage;
  } catch {
    return null;
  }
};

// Successful Translator instances only; creating them is expensive.
const translatorPool = new Map();
// Pairs the browser reports as having no on-device model at all.
const unavailablePairs = new Set();
// De-dupes concurrent creates without caching failures.
const pendingTranslators = new Map();

/**
 * Language packs finish downloading long after the first render, so anything
 * that fell back to the original needs a nudge to try again. Listeners fire
 * once per newly usable language pair.
 */
const readyListeners = new Set();

export function onTranslatorReady(listener) {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

const notifyTranslatorReady = () => {
  readyListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a bad listener must not break the pool */
    }
  });
};

/**
 * Raw availability for one language pair.
 *
 * 'available'   — model is on disk, translation is instant
 * 'downloadable'/'downloading' — usable, but costs a model download first
 * 'unavailable' — unsupported browser or pair
 */
const pairAvailability = async (sourceLanguage, targetLanguage) => {
  const api = getTranslatorApi();
  if (!api || !sourceLanguage || !targetLanguage) return 'unavailable';
  if (sourceLanguage === targetLanguage) return 'unavailable';

  try {
    if (typeof api.availability === 'function') {
      return (await api.availability({ sourceLanguage, targetLanguage })) || 'unavailable';
    }
    // Origin-trial shape: capabilities().languagePairAvailable()
    if (typeof api.capabilities === 'function') {
      const caps = await api.capabilities();
      const state = caps?.languagePairAvailable?.(sourceLanguage, targetLanguage);
      if (state === 'readily') return 'available';
      if (state === 'after-download') return 'downloadable';
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
};

const USABLE = new Set(['available', 'downloadable', 'downloading']);

const routeCache = new Map();

/**
 * How to get from one BCP-47 language to another, and what it will cost:
 * `{ hops, availability }`, or null when the pair is unreachable.
 *
 * Chrome ships packs paired with English, so a direct non-English pair usually
 * reports 'unavailable' even though both halves exist. Pivoting makes every
 * supported locale reachable rather than only English — and reporting the
 * *worst* availability across the hops is what lets the UI say "this will
 * download a model" before the user commits to waiting.
 */
const resolveRoute = (sourceLanguage, targetLanguage) => {
  if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) {
    return Promise.resolve(null);
  }

  const key = `${sourceLanguage}->${targetLanguage}`;
  if (routeCache.has(key)) return routeCache.get(key);

  const pending = (async () => {
    // Only settled verdicts are worth remembering. A 'downloadable' route
    // becomes 'available' the moment its pack finishes, so caching that answer
    // would leave the UI warning about a download that already happened.
    const remember = (route) => {
      if (!route || route.availability === 'available') routeCache.set(key, Promise.resolve(route));
      else routeCache.delete(key);
      return route;
    };

    const direct = await pairAvailability(sourceLanguage, targetLanguage);
    if (USABLE.has(direct)) {
      return remember({ hops: [[sourceLanguage, targetLanguage]], availability: direct });
    }

    if (sourceLanguage !== 'en' && targetLanguage !== 'en') {
      const [first, second] = await Promise.all([
        pairAvailability(sourceLanguage, 'en'),
        pairAvailability('en', targetLanguage),
      ]);
      if (USABLE.has(first) && USABLE.has(second)) {
        const ready = first === 'available' && second === 'available';
        return remember({
          hops: [[sourceLanguage, 'en'], ['en', targetLanguage]],
          availability: ready ? 'available' : 'downloadable',
        });
      }
    }

    return remember(null);
  })();

  // Held only until it settles; remember() decides what actually persists.
  routeCache.set(key, pending);
  return pending;
};

/**
 * What translating into `appLang` would cost right now, for UI that wants to
 * warn before a multi-megabyte download: 'available' | 'downloadable' |
 * 'unavailable'. `sourceAppLang` defaults to English, the usual authoring
 * language for UGC in this app.
 */
export async function translationAvailability(appLang, sourceAppLang = 'en') {
  const target = targetFor(appLang);
  const source = targetFor(sourceAppLang);
  if (!target || !source) return 'unavailable';
  if (source === target) return 'available';

  const route = await resolveRoute(source, target);
  return route ? route.availability : 'unavailable';
}

const createTranslator = async (sourceLanguage, targetLanguage, onProgress) => {
  const api = getTranslatorApi();
  if (!api) return null;

  const availability = await pairAvailability(sourceLanguage, targetLanguage);

  if (availability === 'unavailable') {
    unavailablePairs.add(`${sourceLanguage}:${targetLanguage}`);
    return null;
  }

  // 'downloadable'/'downloading' fetches a language pack first. Chrome may
  // require transient user activation for that, so this can reject — see
  // prepareTranslation(), which warms packs from the language switcher click.
  return api.create({
    sourceLanguage,
    targetLanguage,
    monitor(m) {
      if (typeof onProgress !== 'function') return;
      m?.addEventListener?.('downloadprogress', (event) => {
        // `loaded` is 0..1 in the shipped API; older builds sent raw bytes.
        const loaded = Number(event?.loaded);
        if (!Number.isFinite(loaded)) return;
        const total = Number(event?.total);
        const ratio = total > 0 ? loaded / total : loaded;
        onProgress(Math.max(0, Math.min(1, ratio)));
      });
    },
  });
};

const getTranslator = (sourceLanguage, targetLanguage, onProgress) => {
  const key = `${sourceLanguage}:${targetLanguage}`;

  if (translatorPool.has(key)) return Promise.resolve(translatorPool.get(key));
  if (unavailablePairs.has(key)) return Promise.resolve(null);
  if (pendingTranslators.has(key)) return pendingTranslators.get(key);

  const pending = createTranslator(sourceLanguage, targetLanguage, onProgress)
    .then((translator) => {
      if (translator) {
        translatorPool.set(key, translator);
        // Wake up anything that already rendered untranslated text.
        notifyTranslatorReady();
      }
      return translator;
    })
    .catch((error) => {
      // A pack that is still downloading, or a create() that wanted a user
      // gesture, must stay retryable — caching the failure would disable this
      // pair for the rest of the session.
      console.warn(`On-device translator not ready (${key}):`, error?.message || error);
      return null;
    })
    .finally(() => pendingTranslators.delete(key));

  pendingTranslators.set(key, pending);
  return pending;
};

/**
 * Chrome ships packs as X↔en, so a pair like vi→de is only reachable by going
 * through English. Falls back to the two-hop route when the direct pair has no
 * model.
 */
const runTranslation = async (text, source, target) => {
  const direct = await getTranslator(source, target);
  if (direct) return direct.translate(text);

  if (source !== 'en' && target !== 'en') {
    const [toEnglish, fromEnglish] = await Promise.all([
      getTranslator(source, 'en'),
      getTranslator('en', target),
    ]);
    if (toEnglish && fromEnglish) {
      return fromEnglish.translate(await toEnglish.translate(text));
    }
  }

  return null;
};

/**
 * Downloads the language packs for a target language. Call this from a click
 * handler (the language switcher): Chrome allows pack downloads during
 * transient user activation, which a render-time effect does not have.
 */
export async function prepareTranslation(appLang, contentLanguages = ['en'], onProgress) {
  const target = targetFor(appLang);
  if (!target || !hasTranslator()) return false;

  // Content authored in language X reaches the target as X→en→target, so both
  // legs of the pivot need a pack — not just en→target.
  const sources = [...new Set(contentLanguages.map(targetFor).filter(Boolean))];
  const wanted = new Set();

  sources.forEach((source) => {
    if (source === target) return;
    wanted.add(`${source}:${target}`);
    if (source !== 'en') wanted.add(`${source}:en`);
  });
  if (target !== 'en') {
    wanted.add(`en:${target}`);
    wanted.add(`${target}:en`);
  }

  const results = await Promise.all(
    [...wanted].map((pair) => {
      const [source, dest] = pair.split(':');
      return getTranslator(source, dest, onProgress);
    })
  );
  return results.some(Boolean);
}

/**
 * Dev-only helper: reports what the browser can actually translate, which is
 * the only way to tell a missing language pack from an application bug.
 * Run `__hrTranslateDiag()` in the console.
 */
export async function translationDiagnostics(sourceLanguages = ['en', 'vi']) {
  if (!hasTranslator()) {
    return { supported: false, detector: hasDetector(), pairs: {} };
  }
  const pairs = {};
  for (const appSource of sourceLanguages) {
    const source = targetFor(appSource) || appSource;
    for (const target of Object.values(TRANSLATE_LANG_MAP)) {
      if (source === target) continue;
      try {
        pairs[`${source}→${target}`] = await globalThis.Translator.availability({
          sourceLanguage: source,
          targetLanguage: target,
        });
      } catch (error) {
        pairs[`${source}→${target}`] = `error: ${error?.name || 'unknown'}`;
      }
    }
  }
  return { supported: true, detector: hasDetector(), pairs };
}

if (import.meta.env?.DEV && typeof globalThis !== 'undefined') {
  globalThis.__hrTranslateDiag = translationDiagnostics;
}

const targetFor = (appLang) => TRANSLATE_LANG_MAP[appLang] || null;

/** Cache-only lookup so callers can render a known translation with no flash. */
export function peekCachedTranslation(text, appLang, record = null) {
  if (!text) return null;

  // Manual first, and before the target-language guard: an override is stored
  // against the app's own language code, so it applies even for a UI language
  // the on-device Translator has no BCP-47 mapping for.
  const manual = peekManualTranslation(text, appLang, record);
  if (manual) return manual;

  const target = targetFor(appLang);
  if (!target) return null;
  ensureCache();
  return memoryCache.get(cacheKey(text, target)) ?? null;
}

/**
 * Translates one string and reports why, so callers can distinguish a settled
 * result from one worth retrying once a language pack lands.
 *
 * status: 'done'      — translated, or genuinely nothing to translate
 *         'pending'   — no usable model yet; retry later
 */
export async function translateWithStatus(text, appLang, record = null) {
  const original = text == null ? '' : String(text);

  // A human already answered this one. Nothing downstream can improve on it.
  const manual = peekManualTranslation(original, appLang, record);
  if (manual) return { text: manual, status: 'done' };

  const target = targetFor(appLang);

  if (!original.trim() || !target || isDemoMode()) {
    return { text: original, status: 'done' };
  }
  if (!hasTranslator()) {
    // No on-device translation in this browser: settled, never retry.
    return { text: original, status: 'done' };
  }

  ensureCache();
  const key = cacheKey(original, target);
  const cached = memoryCache.get(key);
  if (cached != null) return { text: cached, status: 'done' };

  const source = await detectLanguage(original);

  // Undetectable source: keep the original, but do NOT cache that decision —
  // caching a failure would freeze this string as untranslatable forever.
  if (!source) return { text: original, status: 'done' };

  if (source === target) {
    // Genuinely nothing to do; safe to remember.
    setCache(key, original);
    return { text: original, status: 'done' };
  }

  try {
    const output = await runTranslation(original, source, target);
    // No model for this pair yet (pack may still be downloading) — leave it
    // uncached and tell the caller to try again.
    if (typeof output !== 'string' || !output.trim()) {
      return { text: original, status: 'pending' };
    }
    setCache(key, output);
    return { text: output, status: 'done' };
  } catch (error) {
    console.warn('On-device translation failed:', error?.message || error);
    return { text: original, status: 'pending' };
  }
}

/** Translates one string, or resolves to the original if that isn't possible. */
export async function translateText(text, appLang, record = null) {
  const { text: out } = await translateWithStatus(text, appLang, record);
  return out;
}

/**
 * Batch helper for the export paths. Sequential on purpose: the on-device model
 * is single-threaded, so parallel calls queue anyway and only add memory churn.
 */
export async function translateTexts(texts, appLang) {
  const list = Array.isArray(texts) ? texts : [];
  // Manual overrides work with no on-device model at all, so the shortcut only
  // applies when there is nothing of either kind to contribute.
  const hasManual = appLang === manualLocale && manualIndex.byText.size > 0;
  if (isDemoMode() || (!hasManual && (!hasTranslator() || !targetFor(appLang)))) {
    return list.map((text) => (text == null ? '' : String(text)));
  }

  const out = [];
  for (const text of list) {
    out.push(await translateText(text, appLang));
  }
  return out;
}

export function clearTranslateCache() {
  memoryCache.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}
