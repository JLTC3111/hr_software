import _React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { prepareTranslation, setManualTranslations } from '../services/translateService.js';
import {
  buildTranslationIndex,
  fetchLocaleTranslations,
} from '../services/ugcTranslationService.js';

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

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState({});
  const [isChanging, setIsChanging] = useState(false);
  // Bumped by the Translation Studio after a save, so an edit is live app-wide
  // without a reload.
  const [overridesVersion, setOverridesVersion] = useState(0);

  // Load translations dynamically
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translationModule = await import(`../translations/${currentLanguage}.js`);
        setTranslations(translationModule.default);
      } catch (_error) {
        console.warn(`Failed to load translations for ${currentLanguage}, falling back to English`);
        if (currentLanguage !== 'en') {
          const englishModule = await import('../translations/en.js');
          setTranslations(englishModule.default);
        }
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Install the hand-authored UGC overrides for this language.
  //
  // Separate from the UI translation bundles above: those ship with the app and
  // cover fixed chrome, these are database rows covering text employees typed.
  // A failure here is not fatal — every string falls back to its on-device
  // machine translation, and then to the original.
  useEffect(() => {
    let cancelled = false;

    fetchLocaleTranslations(currentLanguage)
      .then(({ success, data }) => {
        if (cancelled) return;
        setManualTranslations(currentLanguage, buildTranslationIndex(success ? data : []));
      })
      .catch(() => {
        if (!cancelled) setManualTranslations(currentLanguage, null);
      });

    return () => { cancelled = true; };
  }, [currentLanguage, overridesVersion]);

  // Load saved language from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('hr-app-language');
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

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
  }, [translations]);

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
    refreshManualTranslations
  }), [currentLanguage, changeLanguage, t, isChanging, refreshManualTranslations]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
