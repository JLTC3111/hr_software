/**
 * Compact header actions. BandCells use inline `display`, so a CSS
 * visibility class cannot hide them — this menu is rendered instead, below lg.
 *
 * Trigger is a 52px steel cell like the others. The panel matches the
 * language listbox: chrome fill, ink rule, radius 0.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Moon, MoreVertical, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useNotifications } from '../contexts/NotificationContext.jsx';
import { DISPLAY, BODY } from '../theme/industry.js';

const LANG_SHORT = {
  en: 'EN', de: 'DE', fr: 'FR', jp: 'JA', kr: 'KO', th: 'TH', vn: 'VI', ru: 'RU', es: 'ES',
};

const PAPER_09 = 'rgba(242,242,243,.09)';

function MenuRow({ ind, onClick, active, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.background = ind.hover;
      }}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.style.background = 'transparent';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 0,
        cursor: 'pointer',
        background: active ? ind.accent : 'transparent',
        color: active ? ind.accentInk : ind.ink,
        fontFamily: BODY,
        fontSize: 13,
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}

const MobileHeaderMenu = ({ ind, onLogout }) => {
  const [open, setOpen] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const menuRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();
  const { t, currentLanguage, changeLanguage, languages } = useLanguage();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
        setShowLanguages(false);
      }
    };
    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setShowLanguages(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const short = LANG_SHORT[currentLanguage] || String(currentLanguage || '').toUpperCase();
  const currentName = languages?.[currentLanguage]?.name || '';

  return (
    <div
      ref={menuRef}
      style={{ position: 'relative', flex: 'none', alignSelf: 'stretch', display: 'flex' }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setShowLanguages(false);
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = PAPER_09; }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
        title={t('header.moreOptions', 'More options')}
        aria-label={t('header.moreOptions', 'More options')}
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 52,
          alignSelf: 'stretch',
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderLeft: `1px solid ${ind.tickerRule}`,
          borderRadius: 0,
          color: 'rgba(242,242,243,.8)',
          cursor: 'pointer',
          transition: 'background .15s ease',
        }}
      >
        <MoreVertical size={18} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 13,
              right: 12,
              width: 15,
              height: 15,
              display: 'grid',
              placeItems: 'center',
              background: ind.tickerUp,
              color: ind.tickerBg,
              fontFamily: DISPLAY,
              fontWeight: 600,
              fontSize: 9,
              letterSpacing: '.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 60,
            minWidth: 220,
            background: ind.chrome,
            border: `1px solid ${ind.ink}`,
            borderRadius: 0,
            padding: 3,
          }}
        >
          <MenuRow
            ind={ind}
            onClick={() => setShowLanguages((prev) => !prev)}
          >
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${ind.hairline}`,
                fontFamily: DISPLAY,
                fontWeight: 600,
                fontSize: 10.5,
                letterSpacing: '.06em',
                color: ind.accent,
              }}
            >
              {short}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {t('settings.language', 'Language')}
            </span>
            <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>
              {currentName}
            </span>
            <ChevronDown size={13} strokeWidth={1.5} style={{ flex: 'none', opacity: 0.6 }} />
          </MenuRow>

          {showLanguages && Object.values(languages || {}).map((lang) => {
            const active = lang.code === currentLanguage;
            return (
              <MenuRow
                key={lang.code}
                ind={ind}
                active={active}
                onClick={() => {
                  changeLanguage(lang.code);
                  setShowLanguages(false);
                  setOpen(false);
                }}
              >
                <span
                  style={{
                    width: 22,
                    opacity: 0.65,
                    fontFamily: DISPLAY,
                    fontSize: 10,
                    letterSpacing: '.12em',
                  }}
                >
                  {LANG_SHORT[lang.code] || lang.code.toUpperCase()}
                </span>
                {lang.name}
              </MenuRow>
            );
          })}

          <MenuRow ind={ind} onClick={toggleTheme}>
            {isDarkMode
              ? <Moon size={15} strokeWidth={1.5} style={{ flex: 'none' }} />
              : <Sun size={15} strokeWidth={1.5} style={{ flex: 'none' }} />}
            <span style={{ flex: 1 }}>
              {isDarkMode ? t('theme.light', 'Light mode') : t('theme.dark', 'Dark mode')}
            </span>
          </MenuRow>

          <MenuRow
            ind={ind}
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            <Bell size={15} strokeWidth={1.5} style={{ flex: 'none' }} />
            <span style={{ flex: 1 }}>{t('header.notifications', 'Notifications')}</span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: '.06em',
                  color: ind.accent,
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </MenuRow>

          <MenuRow
            ind={ind}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={15} strokeWidth={1.5} style={{ flex: 'none' }} />
            <span>{t('header.logout', 'Logout')}</span>
          </MenuRow>
        </div>
      )}
    </div>
  );
};

export default MobileHeaderMenu;
