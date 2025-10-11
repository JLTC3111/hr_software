import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { TrendingUp, Users, Briefcase, Award, FileText, Clock, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { bg, text, hover } = useTheme();
  const { t } = useLanguage();
  
  const menuItems = [
    { path: '/time-clock', name: t('nav.timeClock'), icon: ClipboardList },
    { path: '/dashboard', name: t('nav.dashboard'), icon: TrendingUp },
    { path: '/employees', name: t('nav.employees'), icon: Users },
    { path: '/time-tracking', name: t('nav.timeTracking'), icon: Clock },
    { path: '/performance', name: t('nav.performance'), icon: Award },
    { path: '/reports', name: t('nav.reports'), icon: FileText },
  ];

  return (
    <div 
      className={`${isCollapsed ? 'w-16' : 'w-64'} ${bg.secondary} shadow-sm h-screen sticky top-0 transition-all duration-300 ease-in-out`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute -right-3 top-20 z-10 ${bg.secondary} rounded-full p-1 shadow-md border ${hover.bg} transition-colors`}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className={`h-4 w-4 ${text.primary}`} />
        ) : (
          <ChevronLeft className={`h-4 w-4 ${text.primary}`} />
        )}
      </button>

      <nav className="mt-8 px-4">
        <div className="space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `w-full text-left px-4 py-2 rounded-lg flex items-center ${
                    isCollapsed ? 'justify-center' : 'space-x-3'
                  } transition-all duration-300 ${
                    isActive
                      ? 'bg-blue-600 text-[#fff] font-medium'
                      : `${text.secondary} ${hover.bg} hover:${text.primary}`
                  }`
                }
                title={isCollapsed ? item.name : ''}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar