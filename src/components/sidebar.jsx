/**
 * Control rail — band one of the Organization Overview console.
 *
 * 64px collapsed, 236px expanded. The trick that makes the expand read as an
 * expand rather than a reflow: the icon always sits in a fixed 64px grid cell,
 * so it never moves — the label simply appears to the right of that cell. Do
 * not centre the icon in the aside.
 *
 * Radius is 0 everywhere. The active item is one of only two solid objects in
 * the whole system (the other is .btn-primary).
 */
import React, { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  TrendingUp, Users, Award, FileText, AlarmClock, ChevronLeft, ChevronRight, ChevronDown,
  Bell, Cog, CheckSquare, X, UserPlus, CalendarDays, Languages, Timer, SlidersHorizontal,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/AuthContext'
import { isTranslationEditor } from '../utils/translationAccess'
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js'

/** Wayfinding anchor, not a logo — the header already carries the full lockup. */
const BRAND_MARK = 'IC';
const BRAND_NAME = 'ICUE HR Manager';

const RAIL_COLLAPSED = 64;
const RAIL_EXPANDED = 236;
const ICON_CELL = 64;   // fixed — icons never move
const ROW_H = 38;

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [hoveredItem, setHoveredItem] = useState(null); // drives the collapsed popovers
  const [hoverKey, setHoverKey] = useState(null);       // drives the row hover wash
  const [railWidth, setRailWidth] = useState(RAIL_EXPANDED);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const canEditTranslations = isTranslationEditor(user);

  const ind = getIndustry(isDarkMode);

  // Handle resize
  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Floor at the spec width so the rail cannot be dragged narrower than its
      // expanded state; use the collapse toggle for that.
      if (newWidth >= RAIL_EXPANDED && newWidth <= 420) {
        setRailWidth(newWidth);
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
      section: t('sidebar.main', 'MAIN'),
      items: [
        { path: '/time-clock', name: t('nav.timeClock'), icon: AlarmClock },
        // 3d, the live on-site punch. Deliberately its own entry: 3a above
        // enters hours after the fact, this one is for people on the floor.
        { path: '/punch-clock', name: t('nav.punchClock', 'Punch Clock'), icon: Timer },
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
        { path: '/leave-management', name: t('nav.leaveManagement', 'Leave Management'), icon: CalendarDays },
        {
          path: '/workload',
          name: t('nav.workload', 'Work Management'),
          icon: CheckSquare,
          subItems: [
            { path: '/task-listing', name: t('nav.taskListing', 'Task Listing') },
            { path: '/task-review', name: t('nav.taskReview', 'Performance Review') },
          ]
        },
        { path: '/recruitment', name: t('nav.recruitment', 'Recruitment'), icon: UserPlus },
      ]
    },
    {
      section: t('sidebar.analytics', 'ANALYTICS'),
      items: [
        { path: '/personal-goals', name: t('nav.personalGoals', 'Personal Goals'), icon: Award },
        { path: '/reports', name: t('nav.reports'), icon: FileText },
      ]
    },
    {
      section: t('sidebar.settings', 'SETTINGS'),
      items: [
        { path: '/notifications', name: t('nav.notifications', 'Notifications'), icon: Bell },
        // Admin-only; the route and the RLS policies enforce the same rule.
        ...(canEditTranslations
          ? [{ path: '/translations', name: t('nav.translations', 'Translation Studio'), icon: Languages }]
          : []),
        // The rules themselves live here; /settings is this device's preferences.
        { path: '/policy-controls', name: t('nav.policyControls', 'Policy Controls'), icon: SlidersHorizontal },
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

  const width = isCollapsed ? RAIL_COLLAPSED : railWidth;

  const displayName = user?.name || user?.email || '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '—';

  /* -------------------------------------------------------------- styles */

  const labelStyle = (active) => ({
    fontFamily: active ? DISPLAY : BODY,
    fontWeight: active ? 600 : 400,
    fontSize: active ? 14.5 : 14,
    letterSpacing: active ? '.05em' : 0,
    textTransform: active ? 'uppercase' : 'none',
    color: active ? ind.accentInk : ind.ink,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
  });

  const rowBase = {
    height: ROW_H,
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    position: 'relative',
    textAlign: 'left',
    transition: 'background .15s ease',
  };

  /** The fixed 64px cell. Icons live here and never move. */
  const IconCell = ({ children }) => (
    <span
      style={{
        width: ICON_CELL,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {children}
    </span>
  );

  /** Active wins over hover — the accent row never washes out. */
  const rowBg = (key, isActive) => {
    if (isActive) return ind.accent;
    return hoverKey === key ? ind.hover : 'transparent';
  };

  /** Count in a hairline box. The unread dot is a 5×5 square, never a circle. */
  const Badge = ({ count, collapsed }) => {
    if (!count) return null;
    if (collapsed) {
      return (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', top: 8, right: 14, width: 5, height: 5, background: ind.accent }}
        />
      );
    }
    return (
      <span
        style={{
          marginRight: 14,
          flex: 'none',
          border: `1px solid ${ind.dark ? 'rgba(233,235,237,.3)' : 'rgba(29,31,32,.3)'}`,
          padding: '1px 5px',
          fontFamily: DISPLAY,
          fontWeight: 600,
          fontSize: 11,
          lineHeight: 1.3,
          color: ind.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count > 9 ? '9+' : count}
      </span>
    );
  };

  const popoverStyle = {
    position: 'absolute',
    left: '100%',
    marginLeft: 1,
    background: ind.chrome,
    border: `1px solid ${ind.ink}`,
    borderRadius: 0,
    padding: 4,
    minWidth: 168,
    zIndex: 50,
  };

  return (
    <>
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 cursor-pointer"
          style={{ background: 'rgba(29,31,32,.5)' }}
          onClick={closeMobileMenu}
        />
      )}

      {/* Rail */}
      <aside
        ref={sidebarRef}
        style={{
          width,
          background: ind.chrome,
          borderRight: `1px solid ${ind.hairline}`,
          padding: '12px 0',
          overflow: 'hidden',
          transition: isResizing ? 'none' : 'width .2s ease',
          color: ind.ink,
        }}
        className={`
          h-screen lg:h-[calc(100vh-4rem)]
          flex flex-col
          absolute lg:sticky
          lg:flex
          top-0
          left-0
          ${isMobileMenuOpen ? 'translate-x-0' : ' transform -translate-x-[200%] sm:hidden lg:translate-x-0'}
          z-40
        `}
      >
        {/* Resize handle — only meaningful while expanded */}
        {!isCollapsed && (
          <div
            onMouseDown={startResizing}
            className="hidden lg:block absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50"
            style={{ background: isResizing ? ind.accent : 'transparent', touchAction: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ind.accent; }}
            onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
          />
        )}

        {/* Brand mark — 30×30, accent hairline */}
        <div style={{ height: ROW_H, flex: 'none', display: 'flex', alignItems: 'center' }}>
          <IconCell>
            <NavLink
              to="/dashboard"
              onClick={closeMobileMenu}
              aria-label={t('nav.dashboard', 'Dashboard')}
              title={BRAND_NAME}
              style={{
                width: 30, height: 30, border: `1px solid ${ind.accent}`, borderRadius: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.06em',
                color: ind.accent,
              }}
            >
              {BRAND_MARK}
            </NavLink>
          </IconCell>
          {!isCollapsed && (
            // Mobile drawer close. Layout comes from classes, not rowBase —
            // an inline display would beat `lg:hidden`.
            <button
              onClick={closeMobileMenu}
              className="lg:hidden flex items-center ml-auto"
              aria-label={t('common.close', 'Close menu')}
              style={{
                height: 30, padding: '0 12px', border: 'none', borderRadius: 0,
                background: 'transparent', cursor: 'pointer',
              }}
            >
              <X size={18} strokeWidth={1.5} style={{ color: ind.ink }} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0, marginTop: 6 }}>
          {menuStructure.map((section, sectionIndex) => (
            <React.Fragment key={section.section}>
              {/* One hairline divider after MAIN; the spacer pushes SETTINGS down. */}
              {sectionIndex === 1 && (
                <hr style={{ border: 'none', borderTop: `1px solid ${ind.hairline}`, margin: '9px 20px' }} />
              )}
              {sectionIndex === 2 && <div style={{ flex: 1, minHeight: 9 }} />}

              {section.items.map((item) => {
                const Icon = item.icon;
                const hasSubItems = item.subItems && item.subItems.length > 0;
                // Submenus are expanded by default; only collapsed when explicitly toggled off
                const isExpanded = expandedMenus[item.name] !== false;
                const badgeCount = item.path === '/notifications' ? unreadCount : 0;

                return (
                  <div key={item.name} style={{ position: 'relative', flex: 'none' }}>
                    {/* Parent row */}
                    {hasSubItems && !isCollapsed ? (
                      <button
                        onClick={() => toggleSubmenu(item.name)}
                        onMouseEnter={() => { setHoveredItem(item.name); setHoverKey(item.name); }}
                        onMouseLeave={() => { setHoveredItem(null); setHoverKey(null); }}
                        style={{ ...rowBase, background: rowBg(item.name, false) }}
                      >
                        <IconCell>
                          <Icon size={18} strokeWidth={1.5} style={{ color: ind.inkGhost }} />
                        </IconCell>
                        <span style={labelStyle(false)}>{item.name}</span>
                        <ChevronDown
                          size={15}
                          strokeWidth={1.5}
                          style={{
                            flex: 'none', marginRight: 16, color: ind.inkMuted,
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform .2s ease',
                          }}
                        />
                      </button>
                    ) : (
                      <NavLink
                        to={item.path}
                        end={hasSubItems}
                        onClick={closeMobileMenu}
                        onMouseEnter={() => { setHoveredItem(item.name); setHoverKey(item.name); }}
                        onMouseLeave={() => { setHoveredItem(null); setHoverKey(null); }}
                        title={isCollapsed ? item.name : undefined}
                        style={({ isActive }) => ({
                          ...rowBase,
                          background: rowBg(item.name, isActive),
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <IconCell>
                              <Icon
                                size={18}
                                strokeWidth={1.5}
                                style={{ color: isActive ? ind.accentInk : ind.inkGhost }}
                              />
                              {isCollapsed && <Badge count={badgeCount} collapsed />}
                            </IconCell>
                            {!isCollapsed && (
                              <>
                                <span style={labelStyle(isActive)}>{item.name}</span>
                                <Badge count={badgeCount} />
                              </>
                            )}
                          </>
                        )}
                      </NavLink>
                    )}

                    {/* Sub items — indented to start at the icon cell edge */}
                    {hasSubItems && isExpanded && !isCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            end
                            onClick={closeMobileMenu}
                            onMouseEnter={() => setHoverKey(`sub:${subItem.path}`)}
                            onMouseLeave={() => setHoverKey(null)}
                            style={({ isActive }) => ({
                              ...rowBase,
                              height: 30,
                              paddingLeft: ICON_CELL,
                              background: rowBg(`sub:${subItem.path}`, isActive),
                            })}
                          >
                            {({ isActive }) => (
                              <span
                                style={{
                                  display: 'block',
                                  fontFamily: isActive ? DISPLAY : BODY,
                                  fontWeight: isActive ? 600 : 400,
                                  fontSize: 13,
                                  letterSpacing: isActive ? '.05em' : 0,
                                  textTransform: isActive ? 'uppercase' : 'none',
                                  color: isActive ? ind.accentInk : ind.ink,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  paddingRight: 14,
                                }}
                              >
                                {subItem.name}
                              </span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}

                    {/* Collapsed: label tooltip */}
                    {isCollapsed && !hasSubItems && hoveredItem === item.name && (
                      <div style={{ ...popoverStyle, top: 0, minWidth: 0, padding: '7px 11px' }}>
                        <span style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                      </div>
                    )}

                    {/* Collapsed: sub-item popover */}
                    {isCollapsed && hasSubItems && hoveredItem === item.name && (
                      <div
                        style={{ ...popoverStyle, top: 0 }}
                        onMouseEnter={() => setHoveredItem(item.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <div
                          style={{
                            padding: '4px 8px 6px',
                            borderBottom: `1px solid ${ind.hairline}`,
                            marginBottom: 3,
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10,
                            letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.name}
                        </div>
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            onClick={closeMobileMenu}
                            onMouseEnter={() => setHoverKey(`pop:${subItem.path}`)}
                            onMouseLeave={() => setHoverKey(null)}
                            style={({ isActive }) => ({
                              display: 'block',
                              padding: '6px 8px',
                              borderRadius: 0,
                              whiteSpace: 'nowrap',
                              fontFamily: BODY,
                              fontSize: 13,
                              background: rowBg(`pop:${subItem.path}`, isActive),
                              color: isActive ? ind.accentInk : ind.ink,
                            })}
                          >
                            {subItem.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          onMouseEnter={() => setHoverKey('rail:collapse')}
          onMouseLeave={() => setHoverKey(null)}
          className="hidden lg:flex"
          style={{ ...rowBase, marginTop: 2, background: rowBg('rail:collapse', false) }}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <IconCell>
            {isCollapsed
              ? <ChevronRight size={18} strokeWidth={1.5} style={{ color: ind.inkGhost }} />
              : <ChevronLeft size={18} strokeWidth={1.5} style={{ color: ind.inkGhost }} />}
          </IconCell>
          {!isCollapsed && (
            <span style={{ ...labelStyle(false), fontSize: 13, color: ind.inkMuted }}>
              {t('sidebar.collapse', 'Collapse')}
            </span>
          )}
        </button>

        {/* Avatar — 30×30 hairline box, initials */}
        <NavLink
          to="/settings"
          onClick={closeMobileMenu}
          onMouseEnter={() => setHoverKey('rail:avatar')}
          onMouseLeave={() => setHoverKey(null)}
          style={{ ...rowBase, background: rowBg('rail:avatar', false) }}
          title={displayName || t('nav.settings', 'Settings')}
        >
          <IconCell>
            <span
              style={{
                width: 30, height: 30, border: `1px solid ${ind.hairline}`, borderRadius: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.04em',
                color: ind.ink,
              }}
            >
              {initials}
            </span>
          </IconCell>
          {!isCollapsed && (
            <span
              style={{
                fontFamily: BODY, fontSize: 13, color: ind.inkMuted, flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 14,
              }}
            >
              {displayName}
            </span>
          )}
        </NavLink>
      </aside>
    </>
  );
};

export default Sidebar
