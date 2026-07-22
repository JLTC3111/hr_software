import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { TextScramble } from './motion-primitives';
import { cn } from '@/lib/utils';

const LanguageSelector = ({ variant = 'default' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrambleTrigger, setScrambleTrigger] = useState(true);
  const { currentLanguage, changeLanguage, languages, isChanging } = useLanguage();
  const { isDarkMode } = useTheme();
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

  // Re-run scramble whenever the active language changes
  useEffect(() => {
    setScrambleTrigger(false);
    const frame = requestAnimationFrame(() => setScrambleTrigger(true));
    return () => cancelAnimationFrame(frame);
  }, [currentLanguage]);

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode);
    setIsOpen(false);
  };

  const currentLangData = languages[currentLanguage];
  const languageLabel = currentLangData?.name || currentLanguage || 'Language';

  const isIntegrated = variant === 'integrated';

  return (
    <div className={cn('relative', isIntegrated && 'flex-1 min-w-0')} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => {
          setScrambleTrigger(false);
          requestAnimationFrame(() => setScrambleTrigger(true));
        }}
        className={cn(
          'flex items-center space-x-2 px-3 py-2 hover:opacity-80 transition-opacity cursor-pointer w-full',
          isIntegrated
            ? 'rounded-none border-0'
            : 'rounded-lg border'
        )}
        style={{
          backgroundColor: isIntegrated ? 'transparent' : isDarkMode ? '#374151' : '#f3f4f6',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isIntegrated ? 'transparent' : isDarkMode ? '#4b5563' : '#d1d5db',
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-sm font-medium flex items-center space-x-2 min-w-0">
          <img
            src={currentLangData?.flag}
            alt={currentLangData?.name}
            className={cn('w-5 h-5 rounded shrink-0', isChanging && 'animate-pulse')}
          />
          <TextScramble
            as="span"
            className="inline-block min-w-[4.5rem]"
            duration={0.7}
            speed={0.035}
            trigger={scrambleTrigger}
          >
            {languageLabel}
          </TextScramble>
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 shrink-0 transition-all duration-450 origin-center',
          isOpen && 'rotate-180',
          isChanging && 'animate-spin'
        )} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto border"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
          }}
        >
          <div className="py-1">
            {Object.values(languages).map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => handleLanguageChange(language.code)}
                className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center space-x-3 cursor-pointer"
                style={{
                  color: isDarkMode ? '#ffffff' : '#111827',
                  backgroundColor:
                    currentLanguage === language.code
                      ? isDarkMode
                        ? '#4b5563'
                        : '#f3f4f6'
                      : 'transparent',
                  fontWeight: currentLanguage === language.code ? '500' : '400',
                }}
                onMouseEnter={(e) => {
                  if (currentLanguage !== language.code) {
                    e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentLanguage !== language.code) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                role="option"
                aria-selected={currentLanguage === language.code}
              >
                <img src={language.flag} alt={language.name} className="w-5 h-5 rounded" />
                <span>{language.name}</span>
                {currentLanguage === language.code && (
                  <span className="ml-auto" style={{ color: '#60a5fa' }}>
                    ✓
                  </span>
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
