import { indexReusableTranslation, normalizeSource, recordKey } from '../services/ugcTranslationService.js';

export const fieldFilterKey = (entityType, field) => `${entityType}:${field}`;

export const isOutdatedTranslation = (entry, storedSource) => {
  const source = normalizeSource(storedSource);
  return Boolean(source) && source !== entry.sourceText;
};

export function indexStudioTranslations(rows, locales) {
  // Persisted keys are app locales (vn, jp, kr), as in the reader lookup.
  const supported = new Set(locales);
  const index = new Map();
  for (const row of rows) {
    const body = normalizeSource(row.body);
    if (!body || !supported.has(row.locale)) continue;
    const key = recordKey(row.entity_type, row.entity_id, row.field);
    if (!index.has(key)) index.set(key, new Map());
    index.get(key).set(row.locale, {
      body, sourceText: row.source_text, provider: row.provider || 'manual',
    });
  }
  return index;
}

const SOURCE_SCRIPT_MARKERS = [
  ['vn', /[đăơưạ-ỹ]/iu],
  ['jp', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['kr', /\p{Script=Hangul}/u],
  ['th', /\p{Script=Thai}/u],
  ['ru', /\p{Script=Cyrillic}/u],
];

export function studioOriginalLocale(sourceText, saved, locales) {
  const text = normalizeSource(sourceText).normalize('NFC');
  const scripts = SOURCE_SCRIPT_MARKERS.filter(([locale, pattern]) => locales.includes(locale) && pattern.test(text));
  if (scripts.length) return scripts.length === 1 ? scripts[0][0] : null;

  // The legacy English/Vietnamese workflow saved eight targets and left the
  // original unwritten. Only accept that omission when the whole target set
  // is present and the text is consistent with the omitted locale.
  const absent = locales.filter((locale) => !saved?.has(locale));
  if (absent.length !== 1) return null;
  if (absent[0] === 'en' && /^\p{ASCII}+$/u.test(text) && /[a-z]/i.test(text)) return 'en';
  if (absent[0] === 'vn' && /[âêô]/iu.test(text)) return 'vn';
  return null;
}

export function buildStudioQueue(entries, translations, locales) {
  const supported = [...new Set(locales)];
  const fields = new Map();
  const records = new Map();
  const sources = new Map();
  const fieldCounts = new Map();
  let missingCount = 0;
  let missingTranslationCount = 0;
  let outdatedCount = 0;

  for (const entry of entries) {
    if (!normalizeSource(entry.sourceText) || fields.has(entry.key)) continue;
    const saved = translations.get(entry.key);
    const originalLocale = entry.originalLocale === undefined
      ? studioOriginalLocale(entry.sourceText, saved, supported)
      : entry.originalLocale;
    const targets = supported.filter((locale) => locale !== originalLocale);
    const missingLocales = targets.filter((locale) => !saved?.has(locale));
    const outdatedLocales = supported.filter((locale) => isOutdatedTranslation(entry, saved?.get(locale)?.sourceText));
    fields.set(entry.key, {
      ...entry, originalLocale, missingLocales, outdatedLocales,
      translatedCount: targets.length - missingLocales.length,
      localeCount: targets.length,
    });

    const fieldKey = fieldFilterKey(entry.entityType, entry.field);
    fieldCounts.set(fieldKey, (fieldCounts.get(fieldKey) || 0) + 1);
    const source = sources.get(entry.entityType) || {
      records: 0, completeRecords: 0, missingFields: 0, missingTranslations: 0, outdatedFields: 0,
    };
    sources.set(entry.entityType, source);
    const record = `${entry.entityType}:${entry.entityId}`;
    if (!records.has(record)) {
      records.set(record, true);
      source.records += 1;
      source.completeRecords += 1;
    }
    if (missingLocales.length) {
      if (records.get(record)) source.completeRecords -= 1;
      records.set(record, false);
      source.missingFields += 1;
      source.missingTranslations += missingLocales.length;
      missingCount += 1;
      missingTranslationCount += missingLocales.length;
    }
    if (outdatedLocales.length) {
      source.outdatedFields += 1;
      outdatedCount += 1;
    }
  }
  return { fields, fieldCounts, sources, missingCount, missingTranslationCount, outdatedCount };
}

const normalizeSearch = (value) => normalizeSource(value)
  .normalize('NFKD').toLowerCase()
  .replace(/(\p{Script=Latin})\p{M}+/gu, '$1').replace(/đ/g, 'd')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ').trim().replace(/ ?[-‐‑‒–—−] ?/g, '-').normalize('NFC');

const translatedBodies = (translations, key) => [...(translations.get(key)?.values() || [])].map(({ body }) => body);

export function searchStudioQueue(fields, translations, query) {
  const needle = normalizeSearch(query);
  if (!needle) return [...fields.values()];

  const sharedByLocale = new Map();
  for (const saved of translations.values()) {
    for (const [locale, { body, sourceText }] of saved) {
      if (!sharedByLocale.has(locale)) sharedByLocale.set(locale, new Map());
      indexReusableTranslation(sharedByLocale.get(locale), sourceText, body);
    }
  }

  const titleIndex = new Map();
  const exactTitles = [];
  const matches = [];
  for (const item of fields.values()) {
    const title = fields.get(item.recordTitleKey);
    if (title && !titleIndex.has(title.key)) {
      const saved = translations.get(title.key);
      titleIndex.set(title.key, Array.from(sharedByLocale, ([locale, shared]) => (
        normalizeSearch(saved?.get(locale)?.body || shared.get(title.sourceText))
      )));
    }
    const titles = [normalizeSearch(item.recordLabel), normalizeSearch(title?.sourceText), ...(titleIndex.get(title?.key) || [])];
    if (titles.includes(needle)) {
      exactTitles.push(item);
    } else if (titles.some((value) => value.includes(needle)) ||
      [item.sourceText, item.employeeName, ...translatedBodies(translations, item.key)]
        .some((value) => normalizeSearch(value).includes(needle))) {
      matches.push(item);
    }
  }
  return [...exactTitles, ...matches];
}

export function filterStudioQueue(items, { status, sources, fields, language }) {
  return items.filter((item) => {
    if (!sources.has(item.entityType) || !fields.has(fieldFilterKey(item.entityType, item.field))) return false;
    if (status === 'all' || status === 'complete') {
      return (!language || language !== item.originalLocale) && (status === 'all' || item.missingLocales.length === 0);
    }
    if (status === 'partial' && !item.translatedCount) return false;
    const pending = status === 'outdated' ? item.outdatedLocales : item.missingLocales;
    return language ? pending.includes(language) : pending.length > 0;
  });
}

export function nextMissingStudioTranslation(before, after, key, language) {
  const index = before.findIndex((item) => item.key === key);
  const visible = new Map(after.map((item) => [item.key, item]));
  const order = [key, ...before.slice(index + 1).map((item) => item.key), ...after.map((item) => item.key)];
  for (const candidate of order) {
    const missing = visible.get(candidate)?.missingLocales;
    const locale = language ? missing?.find((code) => code === language) : missing?.[0];
    if (locale) return { key: candidate, locale };
  }
  return null;
}
