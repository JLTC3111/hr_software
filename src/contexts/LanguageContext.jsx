import _React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { prepareTranslation } from '../services/translateService.js';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: { code: 'en', name: 'English', flag: '/flags/us.svg' },
  de: { code: 'de', name: 'Deutsch', flag: '/flags/de.svg' },
  fr: { code: 'fr', name: 'Français', flag: '/flags/fr.svg' },
  jp: { code: 'jp', name: '日本語', flag: '/flags/jp.svg' },
  kr: { code: 'kr', name: '한국어', flag: '/flags/kr.svg' },
  th: { code: 'th', name: 'ไทย', flag: '/flags/th.svg' },
  vn: { code: 'vn', name: 'Tiếng Việt', flag: '/flags/vn.svg' },
  ru: { code: 'ru', name: 'Русский', flag: '/flags/ru.svg' },
  es: { code: 'es', name: 'Español', flag: '/flags/es.svg' }
};

/** The saved choice, read before first paint. */
const initialLanguage = () => {
  if (typeof localStorage === 'undefined') return 'en';
  const saved = localStorage.getItem('hr-app-language');
  return saved && SUPPORTED_LANGUAGES[saved] ? saved : 'en';
};

export const LanguageProvider = ({ children }) => {
  // Read straight out of storage rather than mounting on 'en' and correcting in
  // an effect: that ordering loaded the English bundle first, then the real one,
  // so a Vietnamese session flashed English on every reload.
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [translations, setTranslations] = useState({});
  const [translationAdditions, setTranslationAdditions] = useState({});
  const [isChanging, setIsChanging] = useState(false);
  // Bumped by the Translation Studio after a save, so an edit is live app-wide
  // without a reload.
  const [overridesVersion, setOverridesVersion] = useState(0);

  // Load translations dynamically
  useEffect(() => {
    let cancelled = false;

    const loadTranslations = async () => {
      try {
        const [translationModule, additionsModule] = await Promise.all([
          import(`../translations/${currentLanguage}.js`),
          import(`../translations/additions/${currentLanguage}.js`),
        ]);
        if (!cancelled) {
          setTranslations(translationModule.default);
          setTranslationAdditions(additionsModule.default);
        }
      } catch {
        console.warn(`Failed to load translations for ${currentLanguage}, falling back to English`);
        if (currentLanguage !== 'en') {
          const [englishModule, additionsModule] = await Promise.all([
            import('../translations/en.js'),
            import('../translations/additions/en.js'),
          ]);
          if (!cancelled) {
            setTranslations(englishModule.default);
            setTranslationAdditions(additionsModule.default);
          }
        }
      }
    };

    loadTranslations();

    return () => { cancelled = true; };
  }, [currentLanguage]);

  // Tell the document what language it is in. Without this the <html> element
  // stays lang="en" whatever the user picks, which is what screen readers,
  // hyphenation and the browser's own translate prompt actually read.
  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  // Memoize changeLanguage to prevent recreation on each render
  const changeLanguage = useCallback((languageCode) => {
    if (SUPPORTED_LANGUAGES[languageCode]) {
      setIsChanging(true);
      setCurrentLanguage(languageCode);
      localStorage.setItem('hr-app-language', languageCode);
      // Warm the on-device translation packs here: this runs inside the
      // switcher's click, and Chrome only permits pack downloads during
      // transient user activation — a render-time effect would be refused.
      // The outgoing language is passed too: UGC is usually authored in it, and
      // reaching the new target needs that language's pivot pack as well.
      prepareTranslation(languageCode, ['en', currentLanguage]).catch(() => {
        /* translation is a progressive enhancement; ignore */
      });
      setTimeout(() => setIsChanging(false), 600);
    }
  }, [currentLanguage]);

  // Memoize the translation function to prevent recreation
  const t = useCallback((key, fallback = key) => {
    // The redesign catalog is intentionally stored as flat keys so it can add
    // nested paths without inheriting old string/object shape collisions.
    if (Object.prototype.hasOwnProperty.call(translationAdditions, key)) {
      return translationAdditions[key] || fallback || key;
    }

    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return fallback || key;
      }
    }
    // If the resolved value is an object (nested translations), return the fallback
    if (value && typeof value === 'object') {
      return fallback || key;
    }

    return value || fallback || key;
  }, [translationAdditions, translations]);

  const refreshManualTranslations = useCallback(() => {
    setOverridesVersion((v) => v + 1);
  }, []);

  // Memoize the entire context value
  const value = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    t,
    languages: SUPPORTED_LANGUAGES,
    isRTL: currentLanguage === 'ar', // Add if Arabic support needed
    isChanging,
    refreshManualTranslations,
    manualTranslationsVersion: overridesVersion,
  }), [currentLanguage, changeLanguage, t, isChanging, refreshManualTranslations, overridesVersion]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
