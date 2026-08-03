import React, { useMemo } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from './themeToggle'
import LanguageSelector from './LanguageSelector'
import NotificationDropdown from './NotificationDropdown'
import MobileHeaderMenu from './MobileHeaderMenu'
import { ShinyButton } from './ui/shiny-button'
import { cn } from '@/lib/utils'

const Header = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const displayName = user?.name || user?.email || t('header.user', 'HR Team');

  /**
   * One fixed greeting, rendered as plain text.
   *
   * This used to cycle six phrases through a looping typewriter with a shimmer
   * sweep. It sat in the corner of every screen and never stopped moving, which
   * pulled the eye away from whatever the page was actually for. The greeting is
   * ambient information, so it should not animate at all.
   */
  const greeting = useMemo(
    () => t('header.welcomePhrase1', 'Welcome back, {name}').replace('{name}', displayName),
    [t, displayName]
  );

  return (
    <nav className={`${bg.secondary} shadow-sm border-b ${border.primary}`}>
      <div className="px-3 sm:px-4 lg:px-5 xl:px-6">
        <div className="flex justify-between items-center h-14 lg:h-16">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Mobile Menu Button */}
            <button
              onClick={handleMobileMenuToggle}
              className={`lg:hidden p-1.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0 ${
                isDarkMode 
                  ? 'hover:bg-gray-700' 
                  : 'hover:bg-gray-200'
              }`}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className={`h-5 w-5 ${text.primary}`} />
              ) : (
                <Menu className={`h-5 w-5 ${text.primary}`} />
              )}
            </button>

            <div className="shrink-0 flex items-center">
              <img 
                src="/logoIcons/logo.png" 
                alt="Logo" 
                onClick={() => window.open('https://icue.vn', '_blank')} 
                className="h-7 lg:h-8 w-auto object-cover cursor-pointer"
                loading="eager"
                key="header-logo"
              />
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-4">
            <span
              className={cn(
                'text-sm truncate max-w-[22rem]',
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              )}
              title={greeting}
            >
              {greeting}
            </span>
            <LanguageSelector />
            <ThemeToggle />
            <NotificationDropdown />
            <ShinyButton
              type="button"
              onClick={handleLogout}
              shineOnHover
              className={cn(
                'group px-3 py-2 shadow-sm',
                isDarkMode
                  ? 'border-gray-500 bg-gray-700 text-white hover:bg-gray-600 hover:border-gray-400'
                  : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
              )}
              title={t('header.logout', 'Logout')}
            >
              <LogOut className="h-4 w-4 shrink-0 group-hover:animate-ping" />
              <span className="text-sm font-medium">{t('header.logout', 'Logout')}</span>
            </ShinyButton>
          </div>

          {/* Mobile actions — notifications + overflow menu */}
          <div className="flex lg:hidden items-center gap-0.5 shrink-0">
            <NotificationDropdown />
            <MobileHeaderMenu onLogout={handleLogout} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
