import { supabase } from '../config/supabaseClient';
import { isDemoMode } from '../utils/demoHelper';

const translateUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate`;
const CACHE_KEY = 'hr-translate-cache-v1';
const CACHE_MAX = 500;
const TIMEOUT_MS = 8000;

/** App UI language → Google / edge target codes (edge also maps). */
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
    const obj = Object.fromEntries(entries);
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
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
    const first = memoryCache.keys().next().value;
    memoryCache.delete(first);
  }
  persistCache();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Translate an array of UGC strings into the target UI language.
 * Returns originals on demo mode, missing auth, or any failure.
 * Never sends empty strings to the network (kept as-is).
 */
export async function translateTexts(texts, targetLang) {
  ensureCache();
  const list = (Array.isArray(texts) ? texts : [texts]).map((t) =>
    t == null ? '' : String(t)
  );

  if (!targetLang || isDemoMode()) {
    return list;
  }

  const mappedTarget = TRANSLATE_LANG_MAP[targetLang] || targetLang;
  const results = [...list];
  const pendingIndexes = [];
  const pendingTexts = [];
  const pendingKeys = [];

  list.forEach((text, i) => {
    if (!text.trim()) return;
    const key = cacheKey(text, mappedTarget);
    if (memoryCache.has(key)) {
      results[i] = memoryCache.get(key);
      return;
    }
    pendingIndexes.push(i);
    pendingTexts.push(text);
    pendingKeys.push(key);
  });

  if (pendingTexts.length === 0) {
    return results;
  }

  // Dedupe identical pending strings in one Google batch
  const unique = [];
  const uniqueIndexByText = new Map();
  pendingTexts.forEach((text) => {
    if (!uniqueIndexByText.has(text)) {
      uniqueIndexByText.set(text, unique.length);
      unique.push(text);
    }
  });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return results;
    }

    // Chunk to edge max batch (50)
    const CHUNK = 50;
    const translatedUnique = new Array(unique.length);

    for (let start = 0; start < unique.length; start += CHUNK) {
      const chunk = unique.slice(start, start + CHUNK);
      const res = await fetchWithTimeout(translateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          texts: chunk,
          targetLang: mappedTarget,
        }),
      });

      if (!res.ok) {
        console.warn('translateTexts: edge error', res.status);
        return results;
      }

      const json = await res.json();
      if (!json?.success || !Array.isArray(json.translations)) {
        console.warn('translateTexts: bad payload', json?.error);
        return results;
      }

      json.translations.forEach((translated, j) => {
        translatedUnique[start + j] =
          typeof translated === 'string' ? translated : chunk[j];
      });
    }

    pendingIndexes.forEach((resultIndex, p) => {
      const text = pendingTexts[p];
      const uIdx = uniqueIndexByText.get(text);
      const translated = translatedUnique[uIdx] ?? text;
      results[resultIndex] = translated;
      setCache(pendingKeys[p], translated);
    });

    return results;
  } catch (err) {
    console.warn('translateTexts failed, using originals:', err?.message || err);
    return results;
  }
}

/** Translate a single string. */
export async function translateText(text, targetLang) {
  const [out] = await translateTexts([text], targetLang);
  return out;
}

/** Sync cache lookup — null if not cached (or empty / no lang). */
export function peekCachedTranslation(text, targetLang) {
  ensureCache();
  const value = text == null ? '' : String(text);
  if (!value.trim() || !targetLang) return null;
  const mappedTarget = TRANSLATE_LANG_MAP[targetLang] || targetLang;
  const key = cacheKey(value, mappedTarget);
  return memoryCache.has(key) ? memoryCache.get(key) : null;
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
