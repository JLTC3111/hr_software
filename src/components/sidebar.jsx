import React from 'react'
import { NavLink } from 'react-router-dom'
import { TrendingUp, Users, Briefcase, Award, FileText, Clock, ClipboardList } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

const Sidebar = () => {
  const { bg, text, hover } = useTheme();
  const { t } = useLanguage();
  
  const menuItems = [
    { path: '/time-clock', name: t('nav.timeClock', 'Time Clock'), icon: ClipboardList },
    { path: '/dashboard', name: t('nav.dashboard'), icon: TrendingUp },
    { path: '/employees', name: t('nav.employees'), icon: Users },
    { path: '/time-tracking', name: t('nav.timeTracking'), icon: Clock },
    { path: '/performance', name: t('nav.performance'), icon: Award },
    { path: '/reports', name: t('nav.reports'), icon: FileText },
  ];

  return (
    <div className={`w-64 ${bg.secondary} shadow-sm h-screen sticky top-0`}>
      <nav className="mt-8 px-4">
        <div className="space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `w-full text-left px-4 py-2 rounded-lg flex items-center space-x-3 transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-[#fff] font-medium'
                      : `${text.secondary} ${hover.bg} hover:${text.primary}`
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar