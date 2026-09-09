const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async function checkPackage(context) {
  // @electron/asar is provided by electron-builder itself.
  const { listPackage, extractFile } = await import('@electron/asar');
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const archive = path.join(resources, 'app.asar');
  const files = listPackage(archive);
  const allowedRoots = new Set(['desktop', 'dist', 'package.json']);
  for (const entry of files) {
    const filename = entry.replaceAll('\\', '/');
    assert.ok(allowedRoots.has(filename.split('/')[1]), `Unexpected packaged file: ${filename}`);
    assert.ok(!/(?:^|\/)\.env(?:\.|\/|$)/.test(filename), 'Environment files must not be packaged');
  }
  for (const filename of ['main.cjs', 'policy.cjs', 'smoke.cjs']) {
    const expected = await fs.readFile(path.join(__dirname, filename));
    assert.ok(extractFile(archive, path.join('desktop', filename)).equals(expected), `Stale desktop source: ${filename}`);
  }
  console.log(`✓ Package inspection: ${files.length} entries, bundled UI and desktop files only`);
};
