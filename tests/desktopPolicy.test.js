import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import policy from '../desktop/policy.cjs';
import { validateDesktopEnv } from '../desktop/build-config.mjs';

const { isAppUrl, isAppBlob, isExternalUrl, isPermissionAllowed, resolveAssetPath } = policy;

test('notification checks work without webContents while refusing foreign origins and frames', () => {
  assert.equal(isPermissionAllowed('notifications', 'hr-app://app', undefined), true);
  assert.equal(isPermissionAllowed('notifications', 'https://foreign.test', undefined), false);
  assert.equal(isPermissionAllowed('notifications', 'hr-app://app', undefined, 'https://foreign.test'), false);
  assert.equal(isPermissionAllowed('notifications', 'hr-app://app', 'https://foreign.test'), false);
  assert.equal(isPermissionAllowed('clipboard-sanitized-write', 'hr-app://app', 'hr-app://app/login'), true);
  assert.equal(isPermissionAllowed('clipboard-sanitized-write', 'hr-app://app', undefined), false);
  assert.equal(isPermissionAllowed('media', 'hr-app://app', 'hr-app://app'), false);
});

test('desktop origin validation rejects spoofed hosts, credentials, ports and unsafe schemes', () => {
  assert.equal(isAppUrl('hr-app://app/dashboard?tab=open'), true);
  for (const value of ['hr-app://app.attacker.test/', 'hr-app://app@evil/', 'hr-app://user@app/', 'hr-app://app:81/', 'file:///etc/passwd', 'https://app/', 'not a url']) {
    assert.equal(isAppUrl(value), false, value);
  }
});

test('only blobs created on the app origin can open as internal documents', () => {
  assert.equal(isAppBlob('blob:hr-app://app/1223'), true);
  for (const value of ['blob:null/1223', 'blob:https://attacker.test/1223', 'blob:hr-app://app.evil/1223', 'file:///tmp/doc.pdf']) {
    assert.equal(isAppBlob(value), false, value);
  }
});

test('external links cannot invoke local applications through arbitrary schemes', () => {
  assert.equal(isExternalUrl('https://icue.vn/about'), true);
  assert.equal(isExternalUrl('mailto:dev@icue.vn?subject=Help'), true);
  assert.equal(isExternalUrl('tel:+84901234567'), true);
  assert.equal(isExternalUrl('tel:run-command?arg=1'), false);
  for (const value of ['javascript:alert(1)', 'file:///C:/Windows/system32/cmd.exe', 'shell:AppsFolder', 'data:text/html,hi', 'http://icue.vn', 'https://trusted@evil.test', 'mailto:', 'hr-app://app/']) {
    assert.equal(isExternalUrl(value), false, value);
  }
});

test('bundled paths support deep routes and spaces while blocking decoded traversal and private files', () => {
  const root = path.resolve('desktop-fixture');
  assert.equal(resolveAssetPath(root, 'hr-app://app/assets/app.js'), path.join(root, 'assets', 'app.js'));
  assert.equal(resolveAssetPath(root, 'hr-app://app/fonts/My%20Font.ttf'), path.join(root, 'fonts', 'My Font.ttf'));
  assert.equal(resolveAssetPath(root, 'hr-app://app/dashboard?tab=team'), path.join(root, 'dashboard'));
  for (const value of [
    'hr-app://app/%2eenv', 'hr-app://app/%2e%2e%2fsecret', 'hr-app://app/assets/%2e%2e%5csecret',
    'hr-app://app/C%3a/Windows', 'hr-app://app/file.txt%3astream', 'hr-app://app/%00secret',
    'hr-app://app/%zz', 'hr-app://elsewhere/assets/app.js',
  ]) assert.equal(resolveAssetPath(root, value), null, value);
});

const publicEnv = { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_example', VITE_APP_URL: 'https://hr.icue.vn/' };

test('desktop configuration normalizes HTTPS URLs and keeps email resets on the website', () => {
  assert.deepEqual(validateDesktopEnv(publicEnv), { ...publicEnv, VITE_APP_URL: 'https://hr.icue.vn' });
  assert.equal(validateDesktopEnv({ ...publicEnv, VITE_APP_URL: '', VITE_SITE_URL: 'https://hr.icue.vn' }).VITE_APP_URL, 'https://hr.icue.vn');
});

test('desktop packaging fails early for missing configuration and secret API keys', () => {
  const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(validateDesktopEnv({ ...publicEnv, VITE_SUPABASE_ANON_KEY: jwt('anon') }).VITE_SUPABASE_ANON_KEY, jwt('anon'));
  for (const key of ['', 'sb_secret_example', jwt('service_role'), 'not-a-key']) {
    assert.throws(() => validateDesktopEnv({ ...publicEnv, VITE_SUPABASE_ANON_KEY: key }));
  }
  for (const value of ['', 'hr-app://app', 'http://localhost:5173', 'https://user:password@hr.icue.vn', 'https://hr.icue.vn/#token']) {
    assert.throws(() => validateDesktopEnv({ ...publicEnv, VITE_APP_URL: value }), undefined, value);
  }
  assert.throws(() => validateDesktopEnv({ ...publicEnv, VITE_SUPABASE_URL: '' }));
});
