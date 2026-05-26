const FONT_CACHE = new Map();

const CDN = 'https://cdn.jsdelivr.net/gh';

const LATIN_FONT = {
  urls: (origin) => [
    `${origin}/fonts/NotoSans-Regular.ttf`,
    `${CDN}/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf`,
    `${CDN}/indigofeather/fonts@master/NotoSans-Regular.ttf`,
  ],
  vfsName: 'NotoSans-Regular.ttf',
  fontName: 'NotoSans',
  verifyChar: 'Ă',
};

const CJK_FONT = {
  urls: (origin) => [
    `${origin}/fonts/NotoSansCJKsc-Regular.ttf`,
    `${CDN}/indigofeather/fonts@master/NotoSansCJKsc-Regular.ttf`,
  ],
  vfsName: 'NotoSansCJKsc-Regular.ttf',
  fontName: 'NotoSansCJK',
  verifyChar: '日',
};

const THAI_FONT = {
  urls: (origin) => [
    `${origin}/fonts/NotoSansThai-Regular.ttf`,
    `${CDN}/googlefonts/noto-fonts@main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf`,
  ],
  vfsName: 'NotoSansThai-Regular.ttf',
  fontName: 'NotoSansThai',
  verifyChar: 'ก',
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const fetchFontBase64 = async (url) => {
  if (FONT_CACHE.has(url)) {
    return FONT_CACHE.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Font fetch failed (${response.status}): ${url}`);
  }

  const base64 = arrayBufferToBase64(await response.arrayBuffer());
  FONT_CACHE.set(url, base64);
  return base64;
};

const addFontToDoc = async (doc, config) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const urls = config.urls(origin);
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
    }
  }

  throw lastError || new Error(`Unable to load font ${config.fontName}`);
};

const verifyFont = (doc, fontName, sampleChar) => {
  try {
    doc.setFont(fontName, 'normal');
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
    return CJK_FONT.fontName;
  }

  if (loadedFonts.latin) {
    return LATIN_FONT.fontName;
  }

  if (loadedFonts.primaryFontName) {
    return loadedFonts.primaryFontName;
  }

  return 'helvetica';
};

export const loadPdfFonts = async (doc, language) => {
  const loaded = {
    unicodeReady: false,
    latin: false,
    cjk: false,
    thai: false,
    primaryFontName: null,
  };

  const loadConfig = async (config) => {
    const fontName = await addFontToDoc(doc, config);
    if (!verifyFont(doc, fontName, config.verifyChar)) {
      throw new Error(`Font verification failed for ${fontName}`);
    }
    return fontName;
  };

  try {
    if (language === 'jp' || language === 'kr') {
      loaded.primaryFontName = await loadConfig(CJK_FONT);
      loaded.cjk = true;
      try {
        await loadConfig(LATIN_FONT);
        loaded.latin = true;
      } catch (latinError) {
        console.warn('Could not load Latin Noto alongside CJK font', latinError);
      }
    } else if (language === 'th') {
      loaded.primaryFontName = await loadConfig(THAI_FONT);
      loaded.thai = true;
      try {
        await loadConfig(LATIN_FONT);
        loaded.latin = true;
      } catch (latinError) {
        console.warn('Could not load Latin Noto alongside Thai font', latinError);
      }
    } else {
      loaded.primaryFontName = await loadConfig(LATIN_FONT);
      loaded.latin = true;

      if (language === 'vn') {
        try {
          await loadConfig(CJK_FONT);
          loaded.cjk = true;
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

export const getPdfTableFont = (loadedFonts, language) => {
  if (!loadedFonts?.unicodeReady) {
    return 'helvetica';
  }

  if (language === 'jp' || language === 'kr') {
    return loadedFonts.cjk ? CJK_FONT.fontName : 'helvetica';
  }

  if (language === 'th') {
    return loadedFonts.thai ? THAI_FONT.fontName : 'helvetica';
  }

  return loadedFonts.latin ? LATIN_FONT.fontName : 'helvetica';
};
