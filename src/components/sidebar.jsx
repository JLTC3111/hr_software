import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { TrendingUp, Users, Award, FileText, Clock, AlarmClock, ChevronLeft, ChevronRight, Menu, X, ChevronDown, Building2, Bell, Settings, CheckSquare, Sparkles } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [hoveredItem, setHoveredItem] = useState(null);
  const { bg, text, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  
  const menuStructure = [
    {
      section: 'MAIN',
      items: [
        { path: '/time-clock', name: t('nav.timeClock'), icon: AlarmClock },
        { 
          path: '/dashboard', 
          name: t('nav.dashboard'), 
          icon: TrendingUp,
          subItems: [
            { path: '/dashboard', name: t('dashboard.overview', 'Overview') },
            { path: '/control-panel', name: t('nav.controlPanel', 'Control Panel') },
          ]
        },
        { 
          path: '/employees', 
          name: t('nav.employees'), 
          icon: Users,
          subItems: [
            { path: '/time-tracking', name: t('nav.timeTracking', 'Time Tracking') },
            { path: '/employees', name: t('employees.directory', 'Directory') },
            { path: '/employees/add', name: t('employees.addNew', 'Add New') },
          ]
        },
        { 
          path: '/workload', 
          name: t('nav.workload', 'Workload Management'), 
          icon: CheckSquare,
          subItems: [
            { path: '/workload', name: t('nav.taskManagement', 'Task Management') },
            { path: '/task-performance', name: t('nav.taskPerformance', 'Performance Review') },
          ]
        },
      ]
    },
    {
      section: 'ANALYTICS',
      items: [
        { path: '/performance', name: t('nav.performance'), icon: Award },
        { path: '/reports', name: t('nav.reports'), icon: FileText },
      ]
    },
    {
      section: 'SETTINGS',
      items: [
        { path: '/notifications', name: t('nav.notifications', 'Notifications'), icon: Bell },
        { path: '/settings', name: t('nav.settings', 'Settings'), icon: Settings },
      ]
    },
    {
      section: 'DEMO',
      items: [
        { 
          path: '/flubber-demo', 
          name: t('nav.svgMorphing', 'SVG Morphing'), 
          icon: Sparkles,
          subItems: [
            { path: '/flubber-demo', name: t('nav.fullDemo', 'Full Demo') },
            { path: '/morphing-showcase', name: t('nav.showcase', 'Quick Showcase') },
          ]
        },
      ]
    }
  ];

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const toggleSubmenu = (itemName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {!isMobileMenuOpen && (
        <button
          onClick={handleMobileMenuToggle}
          className={`lg:hidden fixed top-11 left-75 z-50 p-2 rounded-lg shadow-lg ${hover.bg} transition-all duration-200`}
          aria-label="Open menu"
        >
          <Menu className={`h-7 w-7 ${text.primary}`} />
        </button>
      )}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`
          ${isCollapsed ? 'w-16' : 'w-64'} 
          ${bg.secondary} 
          shadow-sm 
          h-screen  
          top-0 
          transition-all 
          duration-300 
          ease-in-out
          fixed lg:sticky
          left-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          z-40
        `}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden lg:block absolute -right-3 top-20 z-10 ${bg.secondary} rounded-full p-1 shadow-md border ${hover.bg} transition-colors`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className={`h-4 w-4 ${text.primary}`} />
          ) : (
            <ChevronLeft className={`h-4 w-4 ${text.primary}`} />
          )}
        </button>

        {/* Logo / Branding */}
        <div
          className={`p-4 border-b flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}
          style={{ borderColor: isDarkMode ? '#4b5563' : '#d1d5db' }}
        >
          {!isCollapsed && (
            <button
              onClick={closeMobileMenu}
              className={`lg:hidden p-1 rounded-lg ${hover.bg} transition-colors`}
              aria-label="Close menu"
            >
              <X className={`h-5 w-5 ${text.primary}`} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {menuStructure.map((section, sectionIndex) => (
            <div key={section.section} className={sectionIndex > 0 ? 'mt-6' : ''}>
              {/* Section Header */}
              {!isCollapsed && (
                <h3 className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider ${text.secondary} opacity-60`}>
                  {section.section}
                </h3>
              )}
              
              {/* Menu Items */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isExpanded = expandedMenus[item.name];
                  
                  return (
                    <div key={item.name}>
                      {/* Main Menu Item */}
                      {hasSubItems && !isCollapsed ? (
                        <button
                          onClick={() => toggleSubmenu(item.name)}
                          onMouseEnter={() => setHoveredItem(item.name)}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={`
                            w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between
                            transition-all duration-200
                            ${isExpanded ? `${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}` : `${hover.bg}`}
                            ${text.secondary} hover:${text.primary}
                          `}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                          />
                        </button>
                      ) : (
                        <NavLink
                          to={item.path}
                          end={hasSubItems}
                          onClick={closeMobileMenu}
                          onMouseEnter={() => setHoveredItem(item.name)}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={({ isActive }) =>
                            `w-full text-left px-3 py-2.5 rounded-lg flex items-center relative
                            ${isCollapsed ? 'justify-center' : 'space-x-3'}
                            transition-all duration-200 ${
                              isActive
                                ? 'bg-blue-600 text-white font-medium shadow-md'
                                : `${text.secondary} ${hover.bg} hover:${text.primary}`
                            }`
                          }
                          title={isCollapsed ? item.name : ''}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed && <span className="font-medium">{item.name}</span>}
                          
                          {/* Tooltip for collapsed state */}
                          {isCollapsed && hoveredItem === item.name && (
                            <div className={`absolute left-full ml-2 px-3 py-2 ${bg.secondary} border rounded-lg shadow-lg whitespace-nowrap z-50 scale-in`}
                                 style={{ borderColor: isDarkMode ? '#4b5563' : '#d1d5db' }}>
                              <span className={`text-sm font-medium ${text.primary}`}>{item.name}</span>
                            </div>
                          )}
                        </NavLink>
                      )}
                      
                      {/* Sub Menu Items */}
                      {hasSubItems && isExpanded && !isCollapsed && (
                        <div className="mt-1 ml-8 space-y-1 slide-in-up">
                          {item.subItems.map((subItem) => (
                            <NavLink
                              key={subItem.path}
                              to={subItem.path}
                              end
                              onClick={closeMobileMenu}
                              className={({ isActive }) =>
                                `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                  isActive
                                    ? 'bg-blue-600 text-white font-medium'
                                    : `${text.secondary} ${hover.bg} hover:${text.primary}`
                                }`
                              }
                            >
                              {subItem.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                      
                      {/* Popover for collapsed state with sub-items */}
                      {hasSubItems && isCollapsed && hoveredItem === item.name && (
                        <div 
                          className={`absolute left-full ml-2 top-0 ${bg.secondary} border rounded-lg shadow-xl p-2 min-w-[160px] z-50 scale-in`}
                          style={{ borderColor: isDarkMode ? '#4b5563' : '#d1d5db' }}
                        >
                          <div className={`px-2 py-1 text-xs font-semibold ${text.primary} border-b mb-1`}
                               style={{ borderColor: isDarkMode ? '#4b5563' : '#d1d5db' }}>
                            {item.name}
                          </div>
                          {item.subItems.map((subItem) => (
                            <NavLink
                              key={subItem.path}
                              to={subItem.path}
                              onClick={closeMobileMenu}
                              className={({ isActive }) =>
                                `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                  isActive
                                    ? 'bg-blue-600 text-white'
                                    : `${text.secondary} ${hover.bg} hover:${text.primary}`
                                }`
                              }
                            >
                              {subItem.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar