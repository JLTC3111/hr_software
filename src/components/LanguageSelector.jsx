import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const LanguageSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { isDarkMode, bg, text, border, hover } = useTheme();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode);
    setIsOpen(false);
  };

  const currentLangData = languages[currentLanguage];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', // gray-700 : gray-100
          color: isDarkMode ? '#ffffff' : '#111827', // white : gray-900
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db' // gray-600 : gray-300
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        <span className={`text-sm font-medium flex items-center space-x-2`}>
          <img src={currentLangData?.flag} alt={currentLangData?.name} className="w-5 h-5 rounded" />
          <span>{currentLangData?.name}</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto border"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff', // gray-700 : white
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db' // gray-600 : gray-300
          }}
        >
          <div className="py-1">
            {Object.values(languages).map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center space-x-3"
                style={{
                  color: isDarkMode ? '#ffffff' : '#111827', // white : gray-900
                  backgroundColor: currentLanguage === language.code 
                    ? (isDarkMode ? '#4b5563' : '#f3f4f6') // gray-600 : gray-100
                    : 'transparent',
                  fontWeight: currentLanguage === language.code ? '500' : '400'
                }}
                onMouseEnter={(e) => {
                  if (currentLanguage !== language.code) {
                    e.target.style.backgroundColor = isDarkMode ? '#4b5563' : '#f9fafb'; // gray-600 : gray-50
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentLanguage !== language.code) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
                role="option"
                aria-selected={currentLanguage === language.code}
              >
                <img src={language.flag} alt={language.name} className="w-5 h-5 rounded" />
                <span>{language.name}</span>
                {currentLanguage === language.code && (
                  <span className="ml-auto" style={{ color: '#60a5fa' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
