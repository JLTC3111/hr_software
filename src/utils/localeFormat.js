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
