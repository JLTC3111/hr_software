import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

// Execute the real browser/Edge module with explicit, local-only dependencies.
// Any unexpected import fails rather than reaching a network or live database.
export function loadSource(file, imports, globals = {}) {
  const { code } = transformSync(readFileSync(file, 'utf8'), {
    format: 'cjs', loader: file.endsWith('.ts') ? 'ts' : file.endsWith('.jsx') ? 'jsx' : 'js',
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://fixture.supabase.co', DEV: false }) },
  });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, URL, Response, Request, Blob, TextEncoder,
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    ...globals,
  }, { filename: file });
  return module.exports;
}
