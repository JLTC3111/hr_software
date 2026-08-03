/**
 * App UI language → BCP-47 tag for Intl formatting.
 * Keep in sync with SUPPORTED_LANGUAGES in LanguageContext.
 */
export const LOCALE_TAGS = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  ru: 'ru-RU',
  jp: 'ja-JP',
  kr: 'ko-KR',
  th: 'th-TH',
  vn: 'vi-VN',
};

export const localeTag = (language) => LOCALE_TAGS[language] || 'en-US';

/**
 * Formats a date in the active UI language rather than the browser's locale.
 * Returns '' for missing/invalid values so callers can guard on falsiness.
 */
export const formatDate = (value, language, options) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeTag(language), options);
};

/**
 * Grouped number for display — 1200000 → "1,200,000". Salaries and headcounts get
 * large enough that ungrouped digits stop being readable at a glance.
 * Returns '' for missing/invalid values so callers can guard on falsiness.
 */
export const formatNumber = (value, language, options) => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[\s,_]/g, ''));
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(localeTag(language), options).format(n);
};

/**
 * The inverse, for text inputs: strips grouping separators (and stray spaces)
 * so a pasted or typed "1,200,000" parses. Returns NaN when there is no number.
 */
export const parseNumberInput = (value) => {
  const cleaned = String(value ?? '').replace(/[\s,_]/g, '');
  if (cleaned === '' || cleaned === '-') return NaN;
  return Number(cleaned);
};

/**
 * Keeps a numeric text field readable while it is being typed: group the integer
 * part, leave a trailing decimal point and its digits alone so "1,200." and
 * "1,200.5" both survive a keystroke.
 */
export const groupNumberInput = (value, language) => {
  const raw = String(value ?? '').replace(/[\s,_]/g, '');
  if (raw === '') return '';
  const negative = raw.startsWith('-');
  const [intPart = '', decPart] = (negative ? raw.slice(1) : raw).split('.');
  if (!/^\d*$/.test(intPart)) return String(value);
  const grouped = intPart === '' ? '' : formatNumber(intPart, language, { maximumFractionDigits: 0 });
  const sign = negative ? '-' : '';
  if (decPart === undefined) return `${sign}${grouped}`;
  return `${sign}${grouped}.${decPart.replace(/\D/g, '')}`;
};
