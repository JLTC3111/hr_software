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

/**
 * UI language → ISO currency when the job location does not name a country.
 * Location wins: Tokyo + English UI still stores yen. Language is not a
 * conversion rate.
 */
export const CURRENCY_BY_LANGUAGE = {
  en: 'USD',
  de: 'EUR',
  fr: 'EUR',
  es: 'EUR',
  ru: 'RUB',
  jp: 'JPY',
  kr: 'KRW',
  th: 'THB',
  vn: 'VND',
};

export const currencyForLanguage = (language) => CURRENCY_BY_LANGUAGE[language] || 'USD';

const foldLocation = (value) => {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return '';
  return `${raw} ${raw.normalize('NFD').replace(/\p{M}/gu, '')}`;
};

const locationHayHas = (hay, needle) => {
  if (/[^\x00-\x7F]/.test(needle)) return hay.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(hay);
};

/**
 * Cities that exist in more than one country. Region tokens decide; a bare
 * city name uses the default (London → GBP, London, Ontario → CAD).
 */
const LOCATION_HOMONYMS = [
  {
    city: 'london',
    defaultCurrency: 'GBP',
    variants: [
      { currency: 'CAD', tokens: ['ontario', 'canada', 'london, on'] },
      { currency: 'USD', tokens: ['ohio', 'kentucky'] },
      { currency: 'GBP', tokens: ['uk', 'united kingdom', 'england', 'britain', 'greater london'] },
    ],
  },
  {
    city: 'paris',
    defaultCurrency: 'EUR',
    variants: [
      { currency: 'USD', tokens: ['texas', 'illinois', 'tennessee', 'idaho', 'usa', 'united states'] },
      { currency: 'EUR', tokens: ['france', 'frankreich', 'île-de-france', 'ile-de-france'] },
    ],
  },
  {
    city: 'birmingham',
    defaultCurrency: 'GBP',
    variants: [
      { currency: 'USD', tokens: ['alabama', 'michigan', 'usa', 'united states'] },
      { currency: 'GBP', tokens: ['uk', 'united kingdom', 'england', 'britain'] },
    ],
  },
  {
    city: 'manchester',
    defaultCurrency: 'GBP',
    variants: [
      { currency: 'USD', tokens: ['new hampshire', 'connecticut', 'tennessee', 'usa', 'united states'] },
      { currency: 'GBP', tokens: ['uk', 'united kingdom', 'england', 'britain'] },
    ],
  },
  {
    city: 'cambridge',
    defaultCurrency: 'GBP',
    variants: [
      { currency: 'CAD', tokens: ['ontario', 'canada'] },
      { currency: 'USD', tokens: ['massachusetts', 'maryland', 'ohio', 'usa', 'united states'] },
      { currency: 'GBP', tokens: ['uk', 'united kingdom', 'england', 'britain'] },
    ],
  },
  {
    city: 'vancouver',
    defaultCurrency: 'CAD',
    variants: [
      { currency: 'USD', tokens: ['washington', 'usa', 'united states'] },
      { currency: 'CAD', tokens: ['canada', 'british columbia', 'bc'] },
    ],
  },
  {
    city: 'windsor',
    defaultCurrency: 'GBP',
    variants: [
      { currency: 'CAD', tokens: ['ontario', 'canada'] },
      { currency: 'GBP', tokens: ['uk', 'united kingdom', 'england', 'britain'] },
    ],
  },
  {
    city: 'ontario',
    defaultCurrency: 'CAD',
    variants: [
      { currency: 'USD', tokens: ['california', 'usa', 'united states'] },
      { currency: 'CAD', tokens: ['canada'] },
    ],
  },
];

/**
 * Unambiguous countries and cities. Homonyms are resolved first, so a later
 * "uk" needle cannot override "London, Ontario".
 */
const LOCATION_CURRENCY_NEEDLES = [
  ['JPY', [
    'japan', 'tokyo', 'osaka', 'yokohama', 'nagoya', 'kyoto', 'fukuoka', 'sapporo',
    'kobe', 'nippon', 'nihon', 'japon', 'giappone',
    '日本', '東京', '大阪', '京都', '横浜', '名古屋', '福岡', '札幌', '神戸',
  ]],
  ['KRW', [
    'south korea', 'korea', 'seoul', 'busan', 'incheon', 'suwon',
    'corée', 'corea', 'südkorea', 'sudkorea',
    '한국', '대한민국', '서울', '부산', '인천',
  ]],
  ['THB', [
    'thailand', 'bangkok', 'chiang mai', 'phuket', 'pattaya', 'thaïlande', 'thailande',
    'ไทย', 'กรุงเทพ',
  ]],
  ['VND', [
    'vietnam', 'viet nam', 'hanoi', 'ha noi', 'ho chi minh', 'saigon', 'sai gon',
    'danang', 'da nang', 'can tho',
    'việt nam', 'hà nội', 'hà noi', 'sài gòn', 'tp hcm', 'tphcm',
  ]],
  ['RUB', [
    'russia', 'moscow', 'petersburg', 'novosibirsk', 'russie', 'russland', 'россия',
    'москва', 'санкт-петербург',
  ]],
  ['CAD', [
    'canada', 'toronto', 'montreal', 'calgary', 'ottawa', 'edmonton', 'winnipeg',
    'mississauga', 'brampton', 'halifax', 'quebec',
  ]],
  ['GBP', [
    'united kingdom', 'great britain', 'britain', 'england', 'scotland', 'wales',
    'edinburgh', 'glasgow', 'uk',
  ]],
  ['MXN', [
    'mexico', 'méxico', 'mexico city', 'cdmx', 'guadalajara', 'monterrey', 'cancun',
  ]],
  ['USD', [
    'united states', 'usa', 'u.s.a', 'u.s.',
    'new york', 'nyc', 'los angeles', 'san francisco', 'chicago', 'seattle',
    'boston', 'austin', 'denver', 'miami', 'washington', 'houston', 'dallas',
    'california', 'texas', 'florida', 'illinois', 'massachusetts',
  ]],
  ['EUR', [
    'germany', 'deutschland', 'berlin', 'munich', 'muenchen', 'münchen', 'hamburg',
    'frankfurt', 'cologne', 'koln', 'köln', 'stuttgart', 'dusseldorf', 'düsseldorf',
    'france', 'lyon', 'marseille', 'toulouse', 'frankreich',
    'spain', 'espana', 'españa', 'spanien', 'madrid', 'barcelona', 'valencia',
    'italy', 'italia', 'rome', 'milan', 'milano', 'roma',
    'netherlands', 'amsterdam', 'austria', 'österreich', 'osterreich', 'vienna', 'wien',
    'belgium', 'brussels', 'bruxelles', 'portugal', 'lisbon', 'lisboa',
    'ireland', 'dublin', 'greece', 'athens', 'finland', 'helsinki',
  ]],
];

/** Currency implied by a free-text job location, or null when the place is silent (Remote, HQ). */
export const currencyForLocation = (location) => {
  const hay = foldLocation(location);
  if (!hay) return null;
  for (const entry of LOCATION_HOMONYMS) {
    if (!locationHayHas(hay, entry.city)) continue;
    for (const variant of entry.variants) {
      if (variant.tokens.some((token) => locationHayHas(hay, token))) return variant.currency;
    }
    return entry.defaultCurrency || null;
  }
  for (const [currency, needles] of LOCATION_CURRENCY_NEEDLES) {
    if (needles.some((needle) => locationHayHas(hay, needle))) return currency;
  }
  return null;
};

/** Location wins over UI language. Language is the fallback when the place has no country. */
export const currencyForJob = ({ location, language, currency } = {}) => (
  currencyForLocation(location) || currency || currencyForLanguage(language)
);

/** Where the currency mark sits relative to the number in this locale. */
export const currencyAffix = (language, currency) => {
  const code = currency || currencyForLanguage(language);
  const parts = new Intl.NumberFormat(localeTag(language), {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  const currencyIndex = parts.findIndex((part) => part.type === 'currency');
  const integerIndex = parts.findIndex((part) => part.type === 'integer');
  return {
    currency: code,
    symbol: parts[currencyIndex]?.value || code,
    prefix: currencyIndex >= 0 && (integerIndex < 0 || currencyIndex < integerIndex),
  };
};

export const detectStoredCurrency = (text) => {
  const s = String(text);
  if (/₫|đ|(?:^|[^A-Za-z])VND(?:[^A-Za-z]|$)/i.test(s)) return 'VND';
  if (/€|(?:^|[^A-Za-z])EUR(?:[^A-Za-z]|$)/i.test(s)) return 'EUR';
  if (/£|(?:^|[^A-Za-z])GBP(?:[^A-Za-z]|$)/i.test(s)) return 'GBP';
  if (/₩|(?:^|[^A-Za-z])KRW(?:[^A-Za-z]|$)/i.test(s)) return 'KRW';
  if (/฿|(?:^|[^A-Za-z])THB(?:[^A-Za-z]|$)/i.test(s)) return 'THB';
  if (/₽|(?:^|[^A-Za-z])RUB(?:[^A-Za-z]|$)/i.test(s)) return 'RUB';
  if (/[¥￥]|円|(?:^|[^A-Za-z])JPY(?:[^A-Za-z]|$)/i.test(s)) return 'JPY';
  if (/MX\$|(?:^|[^A-Za-z])MXN(?:[^A-Za-z]|$)/i.test(s)) return 'MXN';
  if (/CA\$|(?:^|[^A-Za-z])CAD(?:[^A-Za-z]|$)/i.test(s)) return 'CAD';
  if (/US\$|(?:^|[^A-Za-z])USD(?:[^A-Za-z]|$)/i.test(s) || /\$/.test(s)) return 'USD';
  return null;
};

const parseSalarySide = (side) => {
  const text = String(side);
  if (!/\d/.test(text)) return '';
  const thousand = /(?:\d)[\d.,\s]*k\b/i.test(text);
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(thousand ? n * 1000 : n));
};

export const formatSalaryAmount = (value, language = 'en', currency) => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return '';
  const code = currency || currencyForLanguage(language);
  return new Intl.NumberFormat(localeTag(language), {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(n);
};

export const composeSalaryRange = (min, max, language = 'en', currency) => {
  const code = currency || currencyForLanguage(language);
  if (min != null && max != null) {
    return `${formatSalaryAmount(min, language, code)} - ${formatSalaryAmount(max, language, code)}`;
  }
  if (min != null) return `${formatSalaryAmount(min, language, code)}+`;
  if (max != null) return `up to ${formatSalaryAmount(max, language, code)}`;
  return '';
};

export const parseSalaryRange = (range) => {
  if (range == null || range === '') return { salary_min: '', salary_max: '', currency: null };
  const text = String(range);
  const currency = detectStoredCurrency(text);
  if (/up\s*to/i.test(text)) {
    return { salary_min: '', salary_max: parseSalarySide(text), currency };
  }
  const sides = text.split(/\s*[-–—]\s*/).filter((side) => /\d/.test(side));
  const nums = sides.map(parseSalarySide).filter(Boolean);
  if (nums.length === 0) return { salary_min: '', salary_max: '', currency };
  if (/\+/.test(text) && nums.length === 1) return { salary_min: nums[0], salary_max: '', currency };
  return { salary_min: nums[0] || '', salary_max: nums[1] || '', currency };
};

/** Re-render a stored salary_range with its own currency and the viewer's grouping. */
export const formatStoredSalaryRange = (range, language = 'en') => {
  if (range == null || String(range).trim() === '') return '';
  const text = String(range);
  const { salary_min: min, salary_max: max, currency } = parseSalaryRange(text);
  const code = currency || 'USD';
  if (min && max) return composeSalaryRange(min, max, language, code);
  if (min && /\+/.test(text)) return composeSalaryRange(min, null, language, code);
  if (max && /up\s*to/i.test(text)) return composeSalaryRange(null, max, language, code);
  if (min) return formatSalaryAmount(min, language, code);
  if (max) return formatSalaryAmount(max, language, code);
  return text;
};

