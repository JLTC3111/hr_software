import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Load translations dynamically
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translationModule = await import(`../translations/${currentLanguage}.js`);
        setTranslations(translationModule.default);
      } catch (error) {
        console.warn(`Failed to load translations for ${currentLanguage}, falling back to English`);
        if (currentLanguage !== 'en') {
          const englishModule = await import('../translations/en.js');
          setTranslations(englishModule.default);
        }
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Load saved language from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('hr-app-language');
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = (languageCode) => {
    if (SUPPORTED_LANGUAGES[languageCode]) {
      setIsChanging(true);
      setCurrentLanguage(languageCode);
      localStorage.setItem('hr-app-language', languageCode);
      setTimeout(() => setIsChanging(false), 600);
    }
  };

  const t = (key, fallback = key) => {
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
  };

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    languages: SUPPORTED_LANGUAGES,
    isRTL: currentLanguage === 'ar', // Add if Arabic support needed
    isChanging
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
