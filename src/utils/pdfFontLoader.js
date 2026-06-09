const FONT_CACHE = new Map();
const IDB_NAME = 'hr-pdf-fonts';
const IDB_STORE = 'fonts';
const IDB_VERSION = 1;

const CDN = 'https://cdn.jsdelivr.net/gh';

/** Large CJK font can take a while on slow links — keep separate from API timeouts. */
const FONT_FETCH_TIMEOUT_MS = 180_000;

const LATIN_FONT = {
  urls: () => [
    '/fonts/NotoSans-Regular.ttf',
    `${CDN}/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf`,
  ],
  vfsName: 'NotoSans-Regular.ttf',
  fontName: 'NotoSans',
  verifyChar: 'Ă',
};

const CJK_SC_FONT = {
  urls: () => [
    '/fonts/NotoSansCJKsc-Regular.ttf',
    `${CDN}/indigofeather/fonts@master/NotoSansCJKsc-Regular.ttf`,
  ],
  vfsName: 'NotoSansCJKsc-Regular.ttf',
  fontName: 'NotoSansCJK',
  verifyChar: '日',
};

const CJK_JP_FONT = {
  urls: () => [
    '/fonts/NotoSansCJKjp-Regular.ttf',
    '/fonts/NotoSansCJKsc-Regular.ttf',
    `${CDN}/indigofeather/fonts@master/NotoSansCJKsc-Regular.ttf`,
  ],
  vfsName: 'NotoSansCJKjp-Regular.ttf',
  fontName: 'NotoSansCJK',
  verifyChar: '日',
};

const CJK_KR_FONT = {
  urls: () => [
    '/fonts/NotoSansCJKkr-Regular.ttf',
    '/fonts/NotoSansCJKsc-Regular.ttf',
    `${CDN}/indigofeather/fonts@master/NotoSansCJKsc-Regular.ttf`,
  ],
  vfsName: 'NotoSansCJKkr-Regular.ttf',
  fontName: 'NotoSansCJK',
  verifyChar: '한',
};

const THAI_FONT = {
  urls: () => [
    '/fonts/NotoSansThai-Regular.ttf',
    `${CDN}/googlefonts/noto-fonts@main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf`,
  ],
  vfsName: 'NotoSansThai-Regular.ttf',
  fontName: 'NotoSansThai',
  verifyChar: 'ก',
};

const cjkFontForLanguage = (language) => {
  if (language === 'jp') return CJK_JP_FONT;
  if (language === 'kr') return CJK_KR_FONT;
  return CJK_SC_FONT;
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const openFontDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const readFontFromDb = async (cacheKey) => {
  const db = await openFontDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(cacheKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
};

const writeFontToDb = async (cacheKey, base64) => {
  const db = await openFontDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(base64, cacheKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const fetchFontArrayBuffer = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FONT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Font fetch failed (${response.status}): ${url}`);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1024) {
      throw new Error(`Font response too small (${buffer.byteLength} bytes): ${url}`);
    }
    return buffer;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchFontBase64 = async (url) => {
  if (FONT_CACHE.has(url)) {
    return FONT_CACHE.get(url);
  }

  const cached = await readFontFromDb(url);
  if (cached) {
    FONT_CACHE.set(url, cached);
    return cached;
  }

  const buffer = await fetchFontArrayBuffer(url);
  const base64 = arrayBufferToBase64(buffer);
  FONT_CACHE.set(url, base64);
  await writeFontToDb(url, base64);
  return base64;
};

const addFontToDoc = async (doc, config) => {
  const urls = config.urls();
  let lastError;

  for (const url of urls) {
    try {
      const base64 = await fetchFontBase64(url);
      doc.addFileToVFS(config.vfsName, base64);
      doc.addFont(config.vfsName, config.fontName, 'normal');
      doc.setFont(config.fontName, 'normal');
      return config.fontName;
    } catch (error) {
      lastError = error;
      console.warn(`Font load attempt failed (${url}):`, error?.message || error);
    }
  }

  throw lastError || new Error(`Unable to load font ${config.fontName}`);
};

const verifyFont = (doc, fontName, sampleChar) => {
  try {
    doc.setFont(fontName, 'normal');
    const fontList = doc.getFontList?.() || {};
    if (fontList[fontName]) {
      return true;
    }
    const width = doc.getTextWidth(sampleChar);
    return typeof width === 'number' && width > 0;
  } catch {
    return false;
  }
};

export const containsCjk = (text) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(String(text || ''));
export const containsThai = (text) => /[\u0E00-\u0E7F]/.test(String(text || ''));

export const choosePdfFont = (text, loadedFonts) => {
  if (!loadedFonts?.unicodeReady) {
    return 'helvetica';
  }

  const value = String(text || '');

  if (containsThai(value) && loadedFonts.thai) {
    return THAI_FONT.fontName;
  }

  if (containsCjk(value) && loadedFonts.cjk) {
    return loadedFonts.cjkFontName || CJK_SC_FONT.fontName;
  }

  if (loadedFonts.latin) {
    return LATIN_FONT.fontName;
  }

  if (loadedFonts.primaryFontName) {
    return loadedFonts.primaryFontName;
  }

  return 'helvetica';
};

const loadConfig = async (doc, config) => {
  const fontName = await addFontToDoc(doc, config);
  if (!verifyFont(doc, fontName, config.verifyChar)) {
    throw new Error(`Font verification failed for ${fontName}`);
  }
  return fontName;
};

export const loadPdfFonts = async (doc, language) => {
  const loaded = {
    unicodeReady: false,
    latin: false,
    cjk: false,
    thai: false,
    primaryFontName: null,
    cjkFontName: null,
  };

  try {
    if (language === 'jp' || language === 'kr') {
      const cjkConfig = cjkFontForLanguage(language);
      loaded.primaryFontName = await loadConfig(doc, cjkConfig);
      loaded.cjkFontName = cjkConfig.fontName;
      loaded.cjk = true;
      try {
        await loadConfig(doc, LATIN_FONT);
        loaded.latin = true;
      } catch (latinError) {
        console.warn('Could not load Latin Noto alongside CJK font', latinError);
      }
    } else if (language === 'th') {
      loaded.primaryFontName = await loadConfig(doc, THAI_FONT);
      loaded.thai = true;
      try {
        await loadConfig(doc, LATIN_FONT);
        loaded.latin = true;
      } catch (latinError) {
        console.warn('Could not load Latin Noto alongside Thai font', latinError);
      }
    } else {
      loaded.primaryFontName = await loadConfig(doc, LATIN_FONT);
      loaded.latin = true;

      if (language === 'vn') {
        try {
          await loadConfig(doc, CJK_SC_FONT);
          loaded.cjk = true;
          loaded.cjkFontName = CJK_SC_FONT.fontName;
        } catch (cjkError) {
          console.warn('Could not load CJK Noto alongside Latin font', cjkError);
        }
      }
    }

    loaded.unicodeReady = true;
  } catch (error) {
    console.warn('PDF Unicode font loading failed, falling back to Helvetica:', error);
  }

  return loaded;
};

/** Warm font cache in the background so the first PDF export is faster. */
export const prefetchPdfFonts = (language) => {
  if (typeof window === 'undefined') return;

  const configs = [];
  if (language === 'jp' || language === 'kr') {
    configs.push(cjkFontForLanguage(language));
  } else if (language === 'vn') {
    configs.push(CJK_SC_FONT);
  }
  if (language === 'th') {
    configs.push(THAI_FONT);
  }
  configs.push(LATIN_FONT);

  configs.forEach((config) => {
    config.urls().forEach((url) => {
      fetchFontBase64(url).catch((error) => {
        console.warn(`PDF font prefetch skipped (${url}):`, error?.message || error);
      });
    });
  });
};

export const getPdfTableFont = (loadedFonts, language) => {
  if (!loadedFonts?.unicodeReady) {
    return 'helvetica';
  }

  if (language === 'jp' || language === 'kr') {
    return loadedFonts.cjk ? (loadedFonts.cjkFontName || CJK_SC_FONT.fontName) : 'helvetica';
  }

  if (language === 'th') {
    return loadedFonts.thai ? THAI_FONT.fontName : 'helvetica';
  }

  return loadedFonts.latin ? LATIN_FONT.fontName : 'helvetica';
};
