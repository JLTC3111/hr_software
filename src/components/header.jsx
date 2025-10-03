import React from 'react'
import { Users, LogOut } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from './themeToggle'
import LanguageSelector from './LanguageSelector'

const Header = () => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <nav className={`${bg.secondary} shadow-sm border-b ${border.primary}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <span className={`ml-2 text-xl font-bold ${text.primary}`}>{t('header.title')}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`${bg.secondary} text-sm ${text.secondary}`}>
              {t('header.welcome')} {user?.name || ''}
            </div>
            <LanguageSelector />
            <ThemeToggle />
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {user?.name?.substring(0, 2).toUpperCase() || 'HR'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-300' 
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
              title={t('header.logout', 'Logout')}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">{t('header.logout', 'Logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
