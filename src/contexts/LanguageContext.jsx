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
  en: { code: 'en', name: 'English', flag: '🇺🇸' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  jp: { code: 'jp', name: '日本語', flag: '🇯🇵' },
  kr: { code: 'kr', name: '한국어', flag: '🇰🇷' },
  th: { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  vn: { code: 'vn', name: 'Tiếng Việt', flag: '🇻🇳' },
  ru: { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' }
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState({});

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
      setCurrentLanguage(languageCode);
      localStorage.setItem('hr-app-language', languageCode);
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
    
    return value || fallback || key;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    languages: SUPPORTED_LANGUAGES,
    isRTL: currentLanguage === 'ar' // Add if Arabic support needed
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
