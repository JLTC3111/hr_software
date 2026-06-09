/**
 * Downloads Unicode TTF fonts used by jsPDF report exports into public/fonts/.
 * Skips files that already exist with the expected minimum size.
 *
 * Run manually:  npm run fonts:download
 * Also runs before production build so deployed apps serve fonts locally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'fonts');

const CDN = 'https://cdn.jsdelivr.net/gh';

const FONTS = [
  {
    filename: 'NotoSans-Regular.ttf',
    minBytes: 500_000,
    urls: [
      `${CDN}/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf`,
    ],
  },
  {
    filename: 'NotoSansCJKsc-Regular.ttf',
    minBytes: 10_000_000,
    urls: [
      `${CDN}/indigofeather/fonts@master/NotoSansCJKsc-Regular.ttf`,
    ],
  },
  {
    filename: 'NotoSansThai-Regular.ttf',
    minBytes: 30_000,
    urls: [
      `${CDN}/googlefonts/noto-fonts@main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf`,
      `${CDN}/notofonts/noto-fonts@main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf`,
    ],
  },
];

const download = async (url) => {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error(`Response too small (${buffer.length} bytes) — likely not a font file`);
  }
  return buffer;
};

const ensureFont = async ({ filename, minBytes, urls }) => {
  const dest = path.join(OUT_DIR, filename);

  if (fs.existsSync(dest)) {
    const { size } = fs.statSync(dest);
    if (size >= minBytes) {
      console.log(`✓ ${filename} (${(size / 1024 / 1024).toFixed(1)} MB) — already present`);
      return;
    }
    console.warn(`⚠ ${filename} exists but is too small (${size} bytes) — re-downloading`);
  }

  let lastError;
  for (const url of urls) {
    try {
      console.log(`↓ Downloading ${filename} from ${url}`);
      const buffer = await download(url);
      fs.writeFileSync(dest, buffer);
      console.log(`✓ Saved ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`  failed: ${error.message}`);
    }
  }

  throw lastError || new Error(`Unable to download ${filename}`);
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const font of FONTS) {
    await ensureFont(font);
  }

  console.log('PDF fonts ready in public/fonts/');
};

main().catch((error) => {
  console.error('PDF font download failed:', error.message);
  process.exit(1);
});
