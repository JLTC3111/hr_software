import React, { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { TrendingUp, Users, Award, FileText, Clock, AlarmClock, ChevronLeft, ChevronRight, ChevronDown, Building2, Bell, Cog, CheckSquare, Sparkles, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [hoveredItem, setHoveredItem] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const { bg, text, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  
  // Handle resize
  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) { // Min 200px, Max 600px
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
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
        { path: '/settings', name: t('nav.settings', 'Settings'), icon: Cog },
      ]
    },
  ];

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
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        style={{ width: isCollapsed ? '64px' : `${sidebarWidth}px` }}
        className={`
          ${bg.secondary} 
          shadow-sm 
          h-screen  
          top-0 
          ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}
          fixed lg:sticky
          left-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          z-40
          relative
        `}
      >
        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            onMouseDown={startResizing}
            className={`
              hidden lg:block
              absolute 
              right-0 
              top-0 
              bottom-0 
              w-1 
              cursor-col-resize 
              hover:bg-blue-500 
              ${isResizing ? 'bg-blue-500' : 'bg-transparent'}
              transition-colors
              z-50
            `}
            style={{ touchAction: 'none' }}
          />
        )}
        
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
        <nav className="mt-4 px-3 flex-1">
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
                          <Icon className="h-5 w-5 shrink-0" />
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