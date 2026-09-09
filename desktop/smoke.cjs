const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { app, session } = require('electron');
const { APP_URL } = require('./policy.cjs');

async function runSmokeTest(window) {
  const timeout = setTimeout(() => { console.error('Desktop smoke test timed out.'); app.exit(1); }, 60_000);
  const contents = window.webContents;
  const evaluate = (code) => contents.executeJavaScript(code);
  const errors = [];
  contents.on('console-message', (details) => {
    if (details.level === 'error' && /Uncaught|Content Security Policy|Refused to/.test(details.message)) errors.push(details.message);
  });
  // Verification never contacts live HR services, signs in, or sends analytics.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  async function waitForLogin() {
    for (let i = 0; i < 200; i++) {
      if (await evaluate("Boolean(document.querySelector('input[type=password]'))")) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Login screen did not render while offline.');
  }
  if (contents.isLoading()) await new Promise((resolve) => contents.once('did-finish-load', resolve));
  await waitForLogin();
  assert.equal(await evaluate('typeof window.require'), 'undefined');
  assert.equal(await evaluate('typeof window.process'), 'undefined');
  assert.equal(await evaluate('window.isSecureContext'), true);
  assert.equal(await evaluate('location.pathname'), '/login');
  await evaluate("localStorage.setItem('desktop-smoke', 'persisted'); sessionStorage.setItem('desktop-smoke', 'session');");
  await contents.loadURL(`${APP_URL}/dashboard?tab=smoke`);
  await waitForLogin();
  assert.equal(await evaluate("localStorage.getItem('desktop-smoke')"), 'persisted');
  assert.equal(await evaluate("sessionStorage.getItem('desktop-smoke')"), 'session');
  console.log('✓ Offline startup, protected route reload, browser storage, renderer isolation');
  assert.equal(await evaluate("fetch('data:text/plain,profile-image-probe').then(r => r.text())"), 'profile-image-probe');

  const probes = await evaluate(`(async () => {
    const result = {};
    for (const name of ['Archivo-Regular.ttf', 'Archivo-Bold.ttf', 'NotoSans-Regular.ttf', 'NotoSansCJKsc-Regular.ttf', 'NotoSansThai-Regular.ttf']) {
      const response = await fetch('/fonts/' + name);
      result[name] = response.ok && (await response.arrayBuffer()).byteLength > 1000;
    }
    result.missing = (await fetch('/assets/missing-smoke.js')).status;
    result.private = (await fetch('/%2eenv')).status;
    result.post = (await fetch('/', { method: 'POST' })).status;
    const response = await fetch('/', { headers: { accept: 'text/html' } });
    result.csp = response.headers.get('Content-Security-Policy');
    return result;
  })()`);
  for (const [name, result] of Object.entries(probes)) {
    if (name.endsWith('.ttf')) assert.equal(result, true, name);
  }
  assert.equal(probes.missing, 404);
  assert.equal(probes.private, 403);
  assert.equal(probes.post, 405);
  assert.match(probes.csp, /script-src 'self'/);
  console.log('✓ Bundled fonts, missing assets, denied private paths and request methods, CSP');

  const assets = await fs.readdir(path.join(__dirname, '..', 'dist', 'assets'));
  const worker = assets.find((name) => /^pdf\.worker\.min-.*\.mjs$/.test(name));
  assert.ok(worker, 'PDF.js worker must be bundled');
  assert.equal(await evaluate(`new Promise((resolve, reject) => {
    const worker = new Worker('/assets/' + ${JSON.stringify(worker)}, { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('PDF worker did not start')); }, 10000);
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('PDF worker failed')); };
    worker.onmessage = () => { clearTimeout(timer); worker.terminate(); resolve(true); };
  })`), true);
  console.log('✓ PDF.js worker starts from the packaged origin');

  const downloadPath = path.join(app.getPath('userData'), 'smoke-export.csv');
  const downloaded = new Promise((resolve, reject) => {
    session.defaultSession.once('will-download', (_event, item) => {
      item.setSavePath(downloadPath);
      item.once('done', (_event, state) => state === 'completed' ? resolve() : reject(new Error(`Download ${state}`)));
    });
  });
  await evaluate(`(() => {
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob(['name,value\\nsmoke,1'], { type: 'text/csv' }));
    anchor.download = 'smoke-export.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  })()`);
  await downloaded;
  assert.equal(await fs.readFile(downloadPath, 'utf8'), 'name,value\nsmoke,1');
  assert.deepEqual(errors, [], 'Renderer errors');
  window.showInactive();
  await evaluate('document.fonts.ready.then(() => true)');
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const outputDirectory = app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..', 'artifacts');
  await fs.mkdir(outputDirectory, { recursive: true });
  const screenshotPath = path.join(outputDirectory, 'desktop-smoke.png');
  await fs.writeFile(screenshotPath, (await window.capturePage()).toPNG());
  clearTimeout(timeout);
  console.log(`✓ Native Blob export; screenshot saved to ${screenshotPath}`);
}

module.exports = { runSmokeTest };
