export const getEmployeePositionI18nKey = (position) => {
  const raw = String(position ?? '').trim();
  if (!raw) return '';

  // Normalize for comparisons (remove spaces/underscores/hyphens, lowercase)
  const compact = raw
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  // Special-case: marketing wants a stable camelCase key for this label.
  if (compact === 'expertsgroup' || compact === 'expertgroup') return 'expertGroup';

  // If the value already looks like a translation key, keep it stable.
  // - snake_case keys are used widely across the app
  if (raw.includes('_')) return raw.toLowerCase();

  // - camelCase keys should be preserved as-is
  if (/^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(raw)) return raw;

  // Fallback to legacy behavior used in older components: lower + strip whitespace.
  return raw.toLowerCase().replace(/\s+/g, '');
};
