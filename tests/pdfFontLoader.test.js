import test from 'node:test';
import assert from 'node:assert/strict';

// These are the files supplied by scripts/download-pdf-fonts.mjs. Locale-specific
// Japanese and Korean filenames must fall back to the bundled shared CJK face.
const bundledFonts = new Set([
  '/fonts/Archivo-Regular.ttf',
  '/fonts/Archivo-Bold.ttf',
  '/fonts/NotoSans-Regular.ttf',
  '/fonts/NotoSansCJKsc-Regular.ttf',
  '/fonts/NotoSansThai-Regular.ttf',
]);

const createDoc = () => {
  const files = new Map();
  const families = {};
  return {
    files,
    addFileToVFS: (filename, contents) => files.set(filename, contents),
    addFont: (filename, family, style) => {
      assert.ok(files.has(filename), 'font data must be registered before the face');
      (families[family] ??= []).push(style);
    },
    setFont: (family, style) => assert.ok(families[family]?.includes(style)),
    getFontList: () => families,
  };
};

const mockOfflineFonts = (t, available = bundledFonts) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    if (!url.startsWith('/fonts/')) throw new TypeError('External network unavailable');
    if (!available.has(url)) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(2048).fill(42));
  });
  t.mock.method(console, 'warn', () => {});
  return requests;
};

const cases = [
  { language: 'en', text: 'Annual review', font: 'Archivo', cjk: false, thai: false },
  { language: 'vn', text: 'Đánh giá nhân viên', font: 'Archivo', cjk: true, thai: false },
  { language: 'ru', text: 'Оценка сотрудника', font: 'NotoSans', cjk: false, thai: false },
  { language: 'jp', text: '従業員評価', font: 'NotoSansCJK', cjk: true, thai: false },
  { language: 'kr', text: '직원 평가', font: 'NotoSansCJK', cjk: true, thai: false },
  { language: 'th', text: 'การประเมินพนักงาน', font: 'NotoSansThai', cjk: false, thai: true },
];

for (const { language, text, font, cjk, thai } of cases) {
  test(`${language} PDF uses bundled Unicode fonts and bold with external network unavailable`, async (t) => {
    // Each case starts with an empty module font cache, as on first app launch.
    const { loadPdfFonts, choosePdfFont, getPdfTableFont, pdfFontSupportsBold } =
      await import(`../src/utils/pdfFontLoader.js?locale=${language}`);
    const requests = mockOfflineFonts(t);
    const doc = createDoc();

    const loaded = await loadPdfFonts(doc, language);

    assert.equal(loaded.unicodeReady, true);
    assert.equal(loaded.display, true);
    assert.equal(loaded.latin, true);
    assert.equal(loaded.cjk, cjk);
    assert.equal(loaded.thai, thai);
    assert.equal(choosePdfFont(text, loaded), font);
    assert.equal(getPdfTableFont(loaded, language), font);
    assert.equal(choosePdfFont('Đặng', loaded), 'Archivo');
    assert.equal(choosePdfFont('Иван', loaded), 'NotoSans');
    assert.equal(pdfFontSupportsBold('Archivo', loaded), true);
    assert.equal(pdfFontSupportsBold('NotoSans', loaded), false);
    assert.deepEqual(doc.getFontList().Archivo, ['normal', 'bold']);
    assert.equal(doc.files.get('Archivo-Bold.ttf'), Buffer.alloc(2048, 42).toString('base64'));
    assert.ok(requests.includes('/fonts/Archivo-Regular.ttf'));
    assert.ok(requests.includes('/fonts/Archivo-Bold.ttf'));
    assert.ok(requests.includes('/fonts/NotoSans-Regular.ttf'));
    assert.ok(requests.every((url) => url.startsWith('/fonts/')), 'bundled fonts must avoid external requests');

    if (cjk) assert.ok(requests.includes('/fonts/NotoSansCJKsc-Regular.ttf'));
    if (thai) assert.ok(requests.includes('/fonts/NotoSansThai-Regular.ttf'));
    if (language === 'jp' || language === 'kr') {
      assert.equal(requests[0], `/fonts/NotoSansCJK${language}-Regular.ttf`);
      assert.equal(requests[1], '/fonts/NotoSansCJKsc-Regular.ttf');
    }
  });
}

test('a missing bold face preserves Unicode export without claiming native bold support', async (t) => {
  const { loadPdfFonts, choosePdfFont, pdfFontSupportsBold } =
    await import('../src/utils/pdfFontLoader.js?missing-bold');
  const available = new Set(bundledFonts);
  available.delete('/fonts/Archivo-Bold.ttf');
  const requests = mockOfflineFonts(t, available);
  const doc = createDoc();

  const loaded = await loadPdfFonts(doc, 'vn');

  assert.equal(loaded.unicodeReady, true);
  assert.equal(choosePdfFont('Đánh giá', loaded), 'Archivo');
  assert.equal(pdfFontSupportsBold('Archivo', loaded), false);
  assert.deepEqual(doc.getFontList().Archivo, ['normal']);
  assert.equal(requests.filter((url) => !url.startsWith('/fonts/')).length, 1);
});
