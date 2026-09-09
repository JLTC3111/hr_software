const { app, BrowserWindow, Menu, dialog, net, protocol, session, shell } = require('electron');
const fs = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { APP_URL, isAppUrl, isAppBlob, isExternalUrl, isPermissionAllowed, resolveAssetPath, CONTENT_SECURITY_POLICY } = require('./policy.cjs');

const smokeTest = process.argv.includes('--desktop-smoke');
const distRoot = path.join(__dirname, '..', 'dist');
let mainWindow;

// A stable standard origin preserves BrowserRouter, absolute asset paths,
// localStorage and IndexedDB without opening a localhost server.
protocol.registerSchemesAsPrivileged([{
  scheme: 'hr-app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);
app.setName('ICUE HR Manager');
app.setAppUserModelId('vn.icue.hr');

async function serveApp(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
  let filename = resolveAssetPath(distRoot, request.url);
  if (!filename) return new Response(null, { status: 403 });
  try {
    const info = await fs.stat(filename).catch(() => null);
    if (!info?.isFile()) {
      // Only document navigation receives the SPA fallback. A missing font or
      // JS chunk must remain a 404, not a misleading HTML response.
      if (path.extname(filename) || !request.headers.get('accept')?.includes('text/html')) {
        return new Response(null, { status: 404 });
      }
      filename = path.join(distRoot, 'index.html');
    }
    const response = await net.fetch(pathToFileURL(filename).href);
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'no-cache');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
  } catch {
    return new Response('Unable to load the application. Please reinstall ICUE HR Manager.', { status: 500 });
  }
}

function openExternal(url) {
  if (isExternalUrl(url)) shell.openExternal(url).catch(() => {
    dialog.showErrorBox('Unable to open link', 'Please check that a default app is installed for this type of link.');
  });
}

function secureWindow(window) {
  const contents = window.webContents;
  contents.on('will-attach-webview', (event) => event.preventDefault());
  const guardNavigation = (event, url) => {
    if (isAppUrl(url) || isAppBlob(url)) return;
    event.preventDefault();
    openExternal(url);
  };
  contents.on('will-navigate', guardNavigation);
  contents.on('will-redirect', guardNavigation);
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppBlob(url)) {
      // Blob URLs belong to this Chromium session and cannot be opened in the
      // system browser. Keep document previews sandboxed inside the app.
      return { action: 'allow', overrideBrowserWindowOptions: {
        title: 'Document — ICUE HR Manager', width: 1000, height: 800,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
      } };
    }
    openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (child) => secureWindow(child));
}

function configureSession() {
  const appSession = session.defaultSession;
  appSession.protocol.handle('hr-app', serveApp);
  const permitted = new Set(['notifications', 'clipboard-sanitized-write']);
  appSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => (
    isPermissionAllowed(permission, requestingOrigin, contents?.getURL(), details.embeddingOrigin)
  ));
  appSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(Boolean(contents && isAppUrl(contents.getURL()) &&
      isAppUrl(details.requestingUrl) && details.isMainFrame && permitted.has(permission)));
  });
  // Browser download anchors and generated PDF/CSV/XLSX blobs use Electron's
  // native Save dialog. Never silently overwrite a user's existing export.
  appSession.on('will-download', (event, item, contents) => {
    if (!contents || (!isAppUrl(contents.getURL()) && !isAppBlob(contents.getURL()))) {
      event.preventDefault();
      return;
    }
    item.setSaveDialogOptions({ title: 'Save export', properties: ['showOverwriteConfirmation'] });
    item.once('done', (_event, state) => {
      if (state === 'interrupted') {
        dialog.showErrorBox('Download interrupted', 'The file could not be saved. Check your connection and try again.');
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'ICUE HR Manager', width: 1440, height: 960, minWidth: 800, minHeight: 600,
    backgroundColor: '#f7f5ef', show: false,
    icon: path.join(distRoot, 'logoIcons', 'favicon-512x512.png'),
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
    },
  });
  secureWindow(mainWindow);
  mainWindow.once('ready-to-show', () => { if (!smokeTest) mainWindow.show(); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (smokeTest) return app.exit(1);
    if (details.reason !== 'clean-exit') {
      dialog.showMessageBox({ type: 'error', title: 'ICUE HR Manager',
        message: 'The application stopped responding.', detail: 'Reload to continue. Unsaved changes may have been lost.',
        buttons: ['Reload', 'Close'], defaultId: 0, cancelId: 1,
      }).then(({ response }) => { if (response === 0) mainWindow?.reload(); else mainWindow?.close(); });
    }
  });
  mainWindow.loadURL(`${APP_URL}/`).catch(() => {
    if (smokeTest) return app.exit(1);
    dialog.showErrorBox('ICUE HR Manager could not start', 'The application files could not be loaded. Please reinstall the app.');
    app.quit();
  });
  return mainWindow;
}

function configureMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' },
    { label: 'View', submenu: [
      { role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' },
      { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' },
      ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
    ] },
    { role: 'windowMenu' },
  ]));
}

async function start() {
  // Smoke checks have isolated, temporary browser storage; they cannot reuse
  // the developer's HR session or interfere with an already running app.
  if (smokeTest) {
    const profile = mkdtempSync(path.join(app.getPath('temp'), 'icue-hr-smoke-'));
    app.setPath('userData', profile);
  } else if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (!mainWindow) createWindow();
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });
  await app.whenReady();
  configureSession();
  configureMenu();
  if (smokeTest) {
    // Also available in packaged builds so the same checks exercise ASAR
    // loading and the actual application executable before distribution.
    const { runSmokeTest } = require('./smoke.cjs');
    await runSmokeTest(createWindow());
    app.exit(0);
  } else {
    createWindow();
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
start().catch((error) => {
  console.error('Desktop startup failed:', error.message);
  if (!smokeTest) dialog.showErrorBox('ICUE HR Manager could not start', 'Please restart the app. If this continues, reinstall it.');
  app.exit(1);
});
