/**
 * Control rail — band one of the Organization Overview console.
 *
 * 64px collapsed, 236px expanded, in two distinct geometries:
 *
 *   collapsed — the icon sits in a fixed 64px grid cell, centred, so the rail
 *               reads as a strip of glyphs and nothing else.
 *   expanded  — "1a Ledger": rows are 7px/8px with a 10px icon-to-label gutter,
 *               and a submenu is a hairline *branch* indented 17px + 10px so its
 *               children hang under that gutter rather than under the label.
 *
 * The branch rule is the whole idea: nesting is drawn, not indented into
 * ambiguity. Radius is 0 everywhere. The active child is a solid steel block —
 * one of only two solid objects in the system (the other is .btn-primary).
 */
import React, { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  TrendingUp, Users, Award, FileText, AlarmClock, ChevronDown, ChevronRight,
  Bell, Cog, CheckSquare, X, UserPlus, Languages,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { useNotifications } from '../contexts/NotificationContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { isTranslationEditor } from '../utils/translationAccess.js'
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js'

const RAIL_COLLAPSED = 64;
const RAIL_EXPANDED = 236;
const ICON_CELL = 64;   // collapsed: icons are centred in this cell and never move
const ICON_BOX = 18;    // expanded: the icon's own box, gutter comes from ROW_GAP
const ROW_GAP = 10;
/** Top / right / bottom / left. The top is a pixel under the bottom so a run of
 *  rows sits up against its section rule rather than floating below it. */
const ROW_PAD = '5px 8px 6px';
const ROW_H = 38;

/** The submenu branch: 17px of margin + 10px of padding either side of the rule. */
const BRANCH_MARGIN = 17;
const BRANCH_PAD = 10;

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
        {
          // Groups the three attendance-facing entries — clocking in after the
          // fact, punching in live on-site, and the leave calendar — under one
          // branch instead of three loose top-level rows.
          path: '/time-clock',
          name: t('nav.attendanceHub', 'Trung Tâm'),
          icon: AlarmClock,
          subItems: [
            { path: '/time-clock', name: t('nav.timeClock') },
            // 3d, the live on-site punch. Deliberately its own entry: the row
            // above enters hours after the fact, this one is for people on the floor.
            { path: '/punch-clock', name: t('nav.punchClock', 'Punch Clock') },
            { path: '/leave-management', name: t('nav.leaveManagement', 'Leave Management') },
          ]
        },
        {
          path: '/dashboard',
          name: t('nav.dashboard'),
          icon: TrendingUp,
          subItems: [
            { path: '/dashboard', name: t('dashboard.overview', 'Overview') },
            { path: '/control-panel', name: t('nav.controlPanel', 'Control Panel') },
            // The rules themselves — they belong with the console that reports
            // on them, not with /settings, which is this device's preferences.
            { path: '/policy-controls', name: t('nav.policyControls', 'Policy Controls') },
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

  /* -------------------------------------------------------------- styles */

  /** Parent-row label. 13.5px in the ledger; the active row goes to display caps. */
  const labelStyle = (active) => ({
    fontFamily: active ? DISPLAY : BODY,
    fontWeight: active ? 600 : 400,
    fontSize: active ? 14 : 13.5,
    letterSpacing: active ? '.05em' : 0,
    textTransform: active ? 'uppercase' : 'none',
    color: active ? ind.accentInk : ind.ink,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
  });

  /** Section rule — MAIN / ANALYTICS / SETTINGS. */
  const sectionStyle = {
    fontFamily: DISPLAY,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '.16em',
    textTransform: 'uppercase',
    color: ind.dark ? 'rgba(233,235,237,.42)' : 'rgba(29,31,32,.42)',
    padding: '0 8px',
    margin: '8px 0 4px',
    whiteSpace: 'nowrap',
  };

  /** Child links sit a shade above muted — readable, but never louder than a parent. */
  const subInk = ind.dark ? 'rgba(233,235,237,.72)' : 'rgba(29,31,32,.72)';

  const rowBase = {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    cursor: 'pointer',
    position: 'relative',
    textAlign: 'left',
    transition: 'background .15s ease',
    // Collapsed keeps the fixed-cell geometry so glyphs stay centred in 64px;
    // expanded switches to the ledger's 7px/8px row with a 10px gutter.
    ...(isCollapsed
      ? { height: ROW_H, padding: 0, gap: 0 }
      : { minHeight: 32, padding: ROW_PAD, gap: ROW_GAP }),
  };

  /**
   * The icon holder. 64px and centred while collapsed; while expanded it shrinks
   * to the glyph itself and the gutter comes from the row's gap.
   */
  const IconCell = ({ children, size = ICON_BOX }) => (
    <span
      style={{
        width: isCollapsed ? ICON_CELL : size,
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
          marginLeft: 'auto',
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
          // The nav can outgrow a short viewport once a submenu is open, and a
          // clipped rail is worse than a scrolled one. X stays hidden so the
          // collapse transition never shows a horizontal bar.
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: isResizing ? 'none' : 'width .2s ease',
          color: ind.ink,
          /*
           * The band is sticky at the top of the viewport, so the rail hangs off
           * its underside at every width and fills exactly what is left.
           *
           * It used to stick to `top:0` while sizing itself `100vh - header`,
           * which left a header-tall gap under the rail as soon as you scrolled;
           * and on mobile it was `absolute` against the document, so opening the
           * drawer part-way down a page put it off-screen entirely.
           */
          top: 'var(--app-header-h, 60px)',
          height: 'calc(100vh - var(--app-header-h, 60px))',
        }}
        className={`
          flex flex-col
          fixed lg:sticky
          lg:flex
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

        {/*
          No brand mark. The lockup lives in the steel band above, and a second
          one here put two marks in the same top-left corner. What is left is the
          drawer's close control, which only exists below lg — on desktop the
          rail starts straight at the first nav row.
        */}

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0, marginTop: 2 }}>
          {menuStructure.map((section, sectionIndex) => (
            <React.Fragment key={section.section}>
              {/* One hairline divider after MAIN; the spacer pushes SETTINGS down. */}
              {sectionIndex === 1 && (
                <hr style={{ border: 'none', borderTop: `1px solid ${ind.hairline}`, margin: '9px 8px' }} />
              )}
              {sectionIndex === 2 && <div style={{ flex: 1, minHeight: 9 }} />}

              {/* Section rule. Collapsed there is no room for words — the divider
                  above already does the grouping. */}
              {!isCollapsed && <div style={sectionStyle}>{section.section}</div>}

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
                          size={14}
                          strokeWidth={1.5}
                          style={{
                            flex: 'none', marginLeft: 'auto', color: ind.ink, opacity: 0.4,
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

                    {/*
                      Sub items — the branch. 17px of margin puts the rule under
                      the parent's icon-to-label gutter, 10px of padding sets the
                      children off it. The hairline *is* the nesting; the labels
                      are not indented far enough to carry it on their own.

                      The Dashboard branch breathes one pixel more than the rest
                      — its children are whole consoles, not views of one, and
                      the list reads tight at 5px.
                    */}
                    {hasSubItems && isExpanded && !isCollapsed && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          margin: `2px 0 2px ${BRANCH_MARGIN}px`,
                          paddingLeft: BRANCH_PAD,
                          borderLeft: `1px solid ${ind.hairline}`,
                        }}
                      >
                        {item.subItems.map((subItem) => {
                          const padY = item.path === '/dashboard' ? 6 : 5;
                          return (
                            <NavLink
                              key={subItem.path}
                              to={subItem.path}
                              end
                              onClick={closeMobileMenu}
                              onMouseEnter={() => setHoverKey(`sub:${subItem.path}`)}
                              onMouseLeave={() => setHoverKey(null)}
                              style={({ isActive }) => ({
                                display: 'block',
                                border: 'none',
                                borderRadius: 0,
                                textDecoration: 'none',
                                // The active child is a solid steel block, so it
                                // carries the 6px padding regardless of the list.
                                padding: isActive ? '6px 10px' : `${padY}px 10px`,
                                background: rowBg(`sub:${subItem.path}`, isActive),
                                fontFamily: isActive ? DISPLAY : BODY,
                                fontWeight: isActive ? 600 : 400,
                                fontSize: 13,
                                lineHeight: 1.3,
                                letterSpacing: isActive ? '.05em' : 0,
                                textTransform: isActive ? 'uppercase' : 'none',
                                color: isActive ? ind.accentInk : subInk,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                transition: 'background .15s ease',
                              })}
                            >
                              {subItem.name}
                            </NavLink>
                          );
                        })}
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

        {/*
          No avatar row. The rail ends at its last nav item plus the collapse
          control below: the band above already states who is signed in, and
          Settings is reachable from the SETTINGS section a few rows up, so an
          avatar here would have been a second door to the same screen.
        */}
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? t('sidebar.expand', 'Expand sidebar') : t('sidebar.collapse', 'Collapse sidebar')}
          title={isCollapsed ? t('sidebar.expand', 'Expand sidebar') : t('sidebar.collapse', 'Collapse sidebar')}
          className="hidden lg:flex"
          style={{
            flex: 'none',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-end',
            height: ROW_H,
            padding: isCollapsed ? 0 : '0 12px',
            border: 'none',
            borderRadius: 0,
            borderTop: `1px solid ${ind.hairline}`,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <ChevronRight
            size={18}
            strokeWidth={1.5}
            style={{
              color: ind.inkGhost,
              transform: isCollapsed ? 'none' : 'rotate(180deg)',
              transition: 'transform 0.5s ease',
            }}
          />
        </button>
      </aside>
    </>
  );
};

export default Sidebar
