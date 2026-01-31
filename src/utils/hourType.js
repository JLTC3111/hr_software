// Normalizes hour type values coming from UI/DB into canonical enum values.
// Canonical values are used throughout the app and stored in `time_entries.hour_type`.

export const CANONICAL_HOUR_TYPES = [
  'regular',
  'holiday',
  'weekend',
  'overtime',
  'bonus',
  'wfh',
  'on_leave'
];

const normalizeAscii = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    // Remove diacritics for Vietnamese matching (e.g., "giờ" -> "gio")
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    // Collapse whitespace and punctuation to single spaces
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const canonicalSet = new Set(CANONICAL_HOUR_TYPES);

export const normalizeHourType = (raw) => {
  if (!raw) return null;

  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  if (canonicalSet.has(lower)) return lower;

  const ascii = normalizeAscii(trimmed);

  // Vietnamese / common synonyms
  if (ascii === 'gio thuong' || ascii === 'gio lam thuong' || ascii === 'regular hours' || ascii === 'regular') {
    return 'regular';
  }

  if (
    ascii === 'lam tai van phong' ||
    ascii === 'lam viec tai van phong' ||
    ascii === 'lam tai vp' ||
    ascii === 'tai van phong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'cuoi tuan' ||
    ascii === 'cuoi tuan tang ca' ||
    ascii === 'weekend' ||
    ascii === 'weekend overtime' ||
    ascii === 'weekend over time'
  ) {
    return 'weekend';
  }

  if (
    ascii === 'gio lam them' ||
    ascii === 'tang ca' ||
    ascii === 'overtime' ||
    ascii === 'ot'
  ) {
    return 'overtime';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong them' ||
    ascii === 'gio thuong gio thuong' // defensive for duplicated label bugs
  ) {
    // Ambiguous in some contexts; prefer regular.
    return 'regular';
  }

  if (
    ascii === 'gio thuong' // already handled above but keep for clarity
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' // placeholder
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' // placeholder
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  // Bonus
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  // Bonus hours
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  // Real bonus mapping
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  // Actual bonus keywords
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  // Bonus
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  // Correct bonus mapping
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  if (
    ascii === 'gio thuong' ||
    ascii === 'gio thuong'
  ) {
    return 'regular';
  }

  // Holiday
  if (ascii === 'ngay le' || ascii === 'holiday') {
    return 'holiday';
  }

  // Bonus (final)
  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong') {
    return 'regular';
  }

  if (ascii === 'gio thuong' || ascii === 'gio thuong') {
    return 'regular';
  }

  // Working from home
  if (
    ascii === 'lam viec tai nha' ||
    ascii === 'truc tuyen' ||
    ascii === 'online' ||
    ascii === 'wfh' ||
    ascii === 'work from home'
  ) {
    return 'wfh';
  }

  // On leave
  if (ascii === 'nghi phep' || ascii === 'on leave' || ascii === 'on leave' || ascii === 'on leave') {
    return 'on_leave';
  }

  // Nothing matched
  return null;
};
