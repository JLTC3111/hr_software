import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSalaryRange,
  composeSalaryRange,
  formatStoredSalaryRange,
  currencyForLanguage,
  currencyForLocation,
  currencyForJob,
} from '../src/utils/localeFormat.js';

test('parseSalaryRange reads the sample $80,000 seed shape', () => {
  assert.deepEqual(parseSalaryRange('$80,000 - $120,000'), {
    salary_min: '80000',
    salary_max: '120000',
    currency: 'USD',
  });
});

test('parseSalaryRange reads locale grouping and the posted currency mark', () => {
  assert.deepEqual(parseSalaryRange('80.000 ₫ - 120.000 ₫'), {
    salary_min: '80000',
    salary_max: '120000',
    currency: 'VND',
  });
  assert.deepEqual(parseSalaryRange('80.000 € - 120.000 €'), {
    salary_min: '80000',
    salary_max: '120000',
    currency: 'EUR',
  });
  assert.deepEqual(parseSalaryRange('90k - 120k'), {
    salary_min: '90000',
    salary_max: '120000',
    currency: null,
  });
});

test('composeSalaryRange writes the UI language currency, not bare digits', () => {
  assert.equal(composeSalaryRange(80000, 120000), '$80,000 - $120,000');
  assert.equal(composeSalaryRange(80000, null), '$80,000+');
  assert.equal(composeSalaryRange(null, 60000), 'up to $60,000');
  assert.equal(currencyForLanguage('vn'), 'VND');
  assert.equal(currencyForLanguage('de'), 'EUR');
  const vn = composeSalaryRange(80000, 120000, 'vn');
  assert.match(vn, /₫/);
  assert.match(vn, /80\.000/);
  assert.match(vn, /120\.000/);
  const de = composeSalaryRange(80000, 120000, 'de');
  assert.match(de, /€/);
  assert.match(de, /80\.000/);
});

test('a new Vietnamese posting round-trips as VND, not USD', () => {
  const stored = composeSalaryRange(80000, 120000, 'vn');
  assert.deepEqual(parseSalaryRange(stored), {
    salary_min: '80000',
    salary_max: '120000',
    currency: 'VND',
  });
});

test('job location wins over the UI language when it names a country', () => {
  assert.equal(currencyForLocation('Tokyo, Japan'), 'JPY');
  assert.equal(currencyForLocation('tokyo'), 'JPY');
  assert.equal(currencyForLocation('東京'), 'JPY');
  assert.equal(currencyForLocation('Berlin'), 'EUR');
  assert.equal(currencyForLocation('Ho Chi Minh City'), 'VND');
  assert.equal(currencyForLocation('Paris, Texas'), 'USD');
  assert.equal(currencyForLocation('London, UK'), 'GBP');
  assert.equal(currencyForLocation('London'), 'GBP');
  assert.equal(currencyForLocation('London, Ontario, Canada'), 'CAD');
  assert.equal(currencyForLocation('London, Ontario'), 'CAD');
  assert.equal(currencyForLocation('London, ON'), 'CAD');
  assert.equal(currencyForJob({ location: 'London, Ontario, Canada', language: 'en' }), 'CAD');
  assert.equal(currencyForJob({ location: 'London, UK', language: 'en' }), 'GBP');
  assert.equal(currencyForLocation('Toronto, Canada'), 'CAD');
  assert.equal(currencyForLocation('Vancouver, Washington'), 'USD');
  assert.equal(currencyForLocation('Vancouver'), 'CAD');
  assert.equal(currencyForLocation('Ontario, California'), 'USD');
  assert.equal(currencyForLocation('Remote'), null);
  assert.equal(currencyForLocation('Headquarters'), null);
  assert.equal(currencyForJob({ location: 'Tokyo, Japan', language: 'en' }), 'JPY');
  assert.equal(currencyForJob({ location: 'New York', language: 'jp' }), 'USD');
  assert.equal(currencyForJob({ location: 'Remote', language: 'vn' }), 'VND');
  assert.equal(currencyForJob({ location: '', language: 'en' }), 'USD');
});

test('formatStoredSalaryRange keeps the posted currency when the viewer language changes', () => {
  assert.equal(formatStoredSalaryRange('80000 - 120000'), '$80,000 - $120,000');
  assert.equal(formatStoredSalaryRange('$80,000 - $120,000'), '$80,000 - $120,000');
  assert.equal(formatStoredSalaryRange('1500000 - 2000000'), '$1,500,000 - $2,000,000');
  const vnd = composeSalaryRange(80000, 120000, 'vn');
  const viewedInEnglish = formatStoredSalaryRange(vnd, 'en');
  assert.match(viewedInEnglish, /₫/);
  assert.match(viewedInEnglish, /80,000/);
  assert.doesNotMatch(viewedInEnglish, /\$/);
});
