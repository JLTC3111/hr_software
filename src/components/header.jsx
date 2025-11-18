import React from 'react'
import { Users, LogOut, Bell, Menu, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from './themeToggle'
import LanguageSelector from './LanguageSelector'

const Header = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { bg, text, border, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return (
    <nav className={`${bg.secondary} shadow-sm border-b ${border.primary}`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            <button
              onClick={handleMobileMenuToggle}
              className={`lg:hidden p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                isDarkMode 
                  ? 'hover:bg-gray-700' 
                  : 'hover:bg-gray-200'
              }`}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className={`h-6 w-6 ${text.primary}`} />
              ) : (
                <Menu className={`h-6 w-6 ${text.primary}`} />
              )}
            </button>

            <div className="shrink-0 flex items-center">
              <img 
                src="/logoIcons/logo.png" 
                alt="Logo" 
                onClick={() => window.open('https://icue.vn', '_blank')} 
                className="h-8 w-auto object-cover cursor-pointer"
                loading="eager"
                key="header-logo"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`hidden lg:block ${bg.secondary} text-sm ${text.secondary}`}>
              {t('header.welcome')} {user?.name || user?.email}
            </div>
            <div className="flex items-center">
              <LanguageSelector />
            </div>
            <ThemeToggle />
            
            {/* Notification Bell */}
            <button
              onClick={() => navigate('/notifications')}
              className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-300' 
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
              title={t('header.notifications', 'Notifications')}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
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
