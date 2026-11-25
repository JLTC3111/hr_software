import { indexReusableTranslation, normalizeSource, recordKey } from '../services/ugcTranslationService.js';

export const fieldFilterKey = (entityType, field) => `${entityType}:${field}`;

export const isOutdatedTranslation = (entry, storedSource) => {
  const source = normalizeSource(storedSource);
  return Boolean(source) && source !== entry.sourceText;
};

export function indexStudioTranslations(rows, locales) {
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

export function buildStudioQueue(entries, translations, locales) {
  // Sources don't store a language. Every supported locale is an editable
  // slot, independent of the editor's interface language or browser models.
  const applicable = [...new Set(locales)];
  const fields = new Map();
  const records = new Map();
  const sources = new Map();
  const fieldCounts = new Map();
  let missingCount = 0;
  let outdatedCount = 0;

  for (const entry of entries) {
    if (fields.has(entry.key)) continue;
    const saved = translations.get(entry.key);
    const missingLocales = applicable.filter((locale) => !saved?.has(locale));
    const outdatedLocales = applicable.filter((locale) => isOutdatedTranslation(entry, saved?.get(locale)?.sourceText));
    fields.set(entry.key, {
      ...entry, missingLocales, outdatedLocales,
      translatedCount: applicable.length - missingLocales.length,
      localeCount: applicable.length,
    });

    const fieldKey = fieldFilterKey(entry.entityType, entry.field);
    fieldCounts.set(fieldKey, (fieldCounts.get(fieldKey) || 0) + 1);
    const source = sources.get(entry.entityType) || { records: 0, completeRecords: 0, missingFields: 0, outdatedFields: 0 };
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
      missingCount += 1;
    }
    if (outdatedLocales.length) {
      source.outdatedFields += 1;
      outdatedCount += 1;
    }
  }
  return { fields, fieldCounts, sources, missingCount, outdatedCount };
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
    if (status === 'all') return true;
    if (status === 'complete') return item.missingLocales.length === 0;
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
