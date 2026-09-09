import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build, loadEnv } from 'vite';
import { validateDesktopEnv } from '../desktop/build-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = validateDesktopEnv(loadEnv('production', root, 'VITE_'));
Object.assign(process.env, env);
execFileSync(process.execPath, [path.join(root, 'scripts/download-pdf-fonts.mjs')], { cwd: root, stdio: 'inherit' });
await build({ root, mode: 'production' });

// This directory contains generated packaging input only (gitignored).
const staging = path.join(root, 'desktop', 'app');
await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, 'desktop'), { recursive: true });
await cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
for (const name of ['main.cjs', 'policy.cjs', 'smoke.cjs']) {
  await cp(path.join(root, 'desktop', name), path.join(staging, 'desktop', name));
}
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(path.join(staging, 'package.json'), JSON.stringify({
  name: 'icue-hr-manager', version, private: true, main: 'desktop/main.cjs',
  description: 'ICUE HR Manager desktop application', author: 'ICUE',
}, null, 2) + '\n');
console.log('Desktop assets prepared. Only bundled UI assets and desktop runtime files are included.');
