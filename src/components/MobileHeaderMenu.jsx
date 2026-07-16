import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, LogOut, Globe, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '@/lib/utils';

const MobileHeaderMenu = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const menuRef = useRef(null);
  const { isDarkMode, toggleTheme, bg, text, border } = useTheme();
  const { t, currentLanguage, changeLanguage, languages, isChanging } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowLanguages(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen((prev) => !prev);
    setShowLanguages(false);
  };

  const handleLanguageChange = (code) => {
    changeLanguage(code);
    setShowLanguages(false);
    setIsOpen(false);
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  const currentLangData = languages[currentLanguage];

  return (
    <div className="relative lg:hidden" ref={menuRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          'p-2 rounded-lg transition-colors cursor-pointer',
          isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
        )}
        aria-label={t('header.moreOptions', 'More options')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-56 rounded-xl shadow-lg border z-50 overflow-hidden',
            bg.secondary,
            border.primary
          )}
        >
          {/* Language */}
          <div className={cn('border-b', border.primary)}>
            <button
              type="button"
              onClick={() => setShowLanguages((prev) => !prev)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors cursor-pointer',
                text.primary,
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <Globe className={cn('h-4 w-4 shrink-0', isChanging && 'animate-spin')} />
              <span className="flex-1 text-left font-medium">
                {t('settings.language', 'Language')}
              </span>
              {currentLangData && (
                <span className="flex items-center gap-1.5">
                  <img
                    src={currentLangData.flag}
                    alt={currentLangData.name}
                    className="w-4 h-4 rounded"
                  />
                  <span className={cn('text-xs', text.secondary)}>
                    {currentLangData.name}
                  </span>
                </span>
              )}
            </button>

            {showLanguages && (
              <div className={cn('border-t max-h-48 overflow-y-auto', border.primary)}>
                {Object.values(languages).map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => handleLanguageChange(language.code)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer',
                      text.primary,
                      currentLanguage === language.code
                        ? isDarkMode
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                        : isDarkMode
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-50'
                    )}
                  >
                    <img src={language.flag} alt={language.name} className="w-4 h-4 rounded" />
                    <span className="flex-1 text-left">{language.name}</span>
                    {currentLanguage === language.code && (
                      <span className="text-blue-500 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme */}
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors cursor-pointer border-b',
              text.primary,
              border.primary,
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            )}
          >
            {isDarkMode ? (
              <Moon className="h-4 w-4 shrink-0" />
            ) : (
              <Sun className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 text-left font-medium">
              {isDarkMode
                ? t('theme.dark', 'Dark Mode')
                : t('theme.light', 'Light Mode')}
            </span>
            <span
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
                isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  isDarkMode ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer text-red-500',
              isDarkMode ? 'hover:bg-red-950/40' : 'hover:bg-red-50'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t('header.logout', 'Logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileHeaderMenu;
