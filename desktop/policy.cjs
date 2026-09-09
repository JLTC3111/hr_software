const path = require('node:path');

const APP_URL = 'hr-app://app';

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'hr-app:' && url.host === 'app' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isAppBlob(value) {
  return typeof value === 'string' && value.startsWith('blob:') && isAppUrl(value.slice(5));
}

function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && (
      (url.protocol === 'https:' && Boolean(url.hostname)) ||
      (url.protocol === 'mailto:' && Boolean(url.pathname)) ||
      (url.protocol === 'tel:' && /^[+\d(). -]+$/.test(url.pathname) && !url.search && !url.hash)
    );
  } catch {
    return false;
  }
}

function isPermissionAllowed(permission, requestingOrigin, topLevelUrl, embeddingOrigin) {
  if (!isAppUrl(requestingOrigin)) return false;
  if (embeddingOrigin && !isAppUrl(embeddingOrigin)) return false;
  // Electron supplies null webContents for notification permission checks.
  if (permission === 'notifications') return !topLevelUrl || isAppUrl(topLevelUrl);
  return permission === 'clipboard-sanitized-write' && isAppUrl(topLevelUrl);
}

// Validate decoded paths too: encoded separators and Windows drive/ADS paths
// must never allow the renderer to read outside the bundled frontend.
function resolveAssetPath(root, value) {
  if (!isAppUrl(value)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(value).pathname);
  } catch {
    return null;
  }
  if (/[\\\0:]/.test(pathname) || pathname.split('/').some((part) => part.startsWith('.'))) return null;
  const target = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob: https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

module.exports = { APP_URL, isAppUrl, isAppBlob, isExternalUrl, isPermissionAllowed, resolveAssetPath, CONTENT_SECURITY_POLICY };
