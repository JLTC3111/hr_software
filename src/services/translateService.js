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
const hasTranslator = () => typeof globalThis !== 'undefined' && 'Translator' in globalThis;
const hasDetector = () => typeof globalThis !== 'undefined' && 'LanguageDetector' in globalThis;

export const isLocalTranslationSupported = () => hasTranslator();

let detectorPromise = null;
const getDetector = () => {
  if (!hasDetector()) return Promise.resolve(null);
  if (!detectorPromise) {
    detectorPromise = globalThis.LanguageDetector.create().catch((error) => {
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

const createTranslator = async (sourceLanguage, targetLanguage) => {
  const availability = await globalThis.Translator.availability({
    sourceLanguage,
    targetLanguage,
  });

  if (!availability || availability === 'unavailable') {
    unavailablePairs.add(`${sourceLanguage}:${targetLanguage}`);
    return null;
  }

  // 'downloadable'/'downloading' fetches a language pack first. Chrome may
  // require transient user activation for that, so this can reject — see
  // prepareTranslation(), which warms packs from the language switcher click.
  return globalThis.Translator.create({ sourceLanguage, targetLanguage });
};

const getTranslator = (sourceLanguage, targetLanguage) => {
  const key = `${sourceLanguage}:${targetLanguage}`;

  if (translatorPool.has(key)) return Promise.resolve(translatorPool.get(key));
  if (unavailablePairs.has(key)) return Promise.resolve(null);
  if (pendingTranslators.has(key)) return pendingTranslators.get(key);

  const pending = createTranslator(sourceLanguage, targetLanguage)
    .then((translator) => {
      if (translator) translatorPool.set(key, translator);
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
export async function prepareTranslation(appLang, contentLanguages = ['en']) {
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
    [...wanted].map((pair) => getTranslator(...pair.split(':')))
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
export function peekCachedTranslation(text, appLang) {
  const target = targetFor(appLang);
  if (!text || !target) return null;
  ensureCache();
  return memoryCache.get(cacheKey(text, target)) ?? null;
}

/** Translates one string, or resolves to the original if that isn't possible. */
export async function translateText(text, appLang) {
  const original = text == null ? '' : String(text);
  const target = targetFor(appLang);

  if (!original.trim() || !target || isDemoMode() || !hasTranslator()) {
    return original;
  }

  ensureCache();
  const key = cacheKey(original, target);
  const cached = memoryCache.get(key);
  if (cached != null) return cached;

  const source = await detectLanguage(original);

  // Undetectable source: keep the original, but do NOT cache that decision —
  // caching a failure would freeze this string as untranslatable forever.
  if (!source) return original;

  if (source === target) {
    // Genuinely nothing to do; safe to remember.
    setCache(key, original);
    return original;
  }

  try {
    const output = await runTranslation(original, source, target);
    // No model for this pair yet (pack may still be downloading) — leave it
    // uncached so the next render retries.
    if (typeof output !== 'string' || !output.trim()) return original;
    setCache(key, output);
    return output;
  } catch (error) {
    console.warn('On-device translation failed:', error?.message || error);
    return original;
  }
}

/**
 * Batch helper for the export paths. Sequential on purpose: the on-device model
 * is single-threaded, so parallel calls queue anyway and only add memory churn.
 */
export async function translateTexts(texts, appLang) {
  const list = Array.isArray(texts) ? texts : [];
  if (!hasTranslator() || !targetFor(appLang) || isDemoMode()) {
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
