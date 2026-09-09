import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfPreviewUrl, releasePdfPreviewUrl } from '../src/utils/pdfPreviewUrl.js';

const pdfText = '%PDF-1.7\nlocal demo PDF';
const storedPdf = `data:application/pdf;base64,${Buffer.from(pdfText).toString('base64')}`;

test('stored PDF data becomes an independently owned Blob URL without changing its bytes or MIME type', async () => {
  const first = await createPdfPreviewUrl(storedPdf);
  const second = await createPdfPreviewUrl(storedPdf);
  try {
    assert.ok(first.startsWith('blob:'));
    assert.notEqual(first, second);
    const response = await fetch(first);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(await response.text(), pdfText);
    releasePdfPreviewUrl(first);
    await assert.rejects(fetch(first));
    assert.equal(await (await fetch(second)).text(), pdfText);
  } finally {
    URL.revokeObjectURL(first);
    URL.revokeObjectURL(second);
  }
});

test('public and signed PDF URLs are preserved without fetching or revoking them', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  const revokeMock = t.mock.method(URL, 'revokeObjectURL', () => {});
  const signedUrl = 'https://files.example.test/document.pdf?token=example';
  assert.equal(await createPdfPreviewUrl(signedUrl), signedUrl);
  releasePdfPreviewUrl(signedUrl);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(revokeMock.mock.callCount(), 0);
});

test('stored active HTML cannot become an app-origin PDF preview', async () => {
  await assert.rejects(createPdfPreviewUrl('data:text/html,<script>alert(1)</script>'), /not a PDF/);
});

test('modal cleanup preserves the PDF until every opened preview window closes', async (t) => {
  let checkWindows;
  const timer = {};
  t.mock.method(globalThis, 'setInterval', (callback) => {
    checkWindows = callback;
    return timer;
  });
  const clearMock = t.mock.method(globalThis, 'clearInterval', () => {});
  const firstWindow = { closed: false };
  const secondWindow = { closed: false };
  const url = await createPdfPreviewUrl(storedPdf);
  try {
    releasePdfPreviewUrl(url, [firstWindow, secondWindow]);
    assert.equal(await (await fetch(url)).text(), pdfText);
    firstWindow.closed = true;
    checkWindows();
    assert.equal(clearMock.mock.callCount(), 0);
    assert.equal(await (await fetch(url)).text(), pdfText);
    secondWindow.closed = true;
    checkWindows();
    await assert.rejects(fetch(url));
    assert.deepEqual(clearMock.mock.calls[0].arguments, [timer]);
  } finally {
    URL.revokeObjectURL(url);
  }
});
