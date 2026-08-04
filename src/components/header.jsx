/**
 * Header — 5b, the steel band.
 *
 * One 60px full-width band in accent-900 steel with the type reversed to paper.
 * It is the whole header: identity and telemetry in the same bar, so the
 * workspace below starts immediately with the icon rail and the page itself.
 * There is no light chrome and no separate live-status strip any more.
 *
 * Geometry: the band has no padding of its own. Every child is a full-height
 * cell — `align-items:stretch`, no vertical padding — divided by 1px hairlines
 * at .18 alpha. Left cells carry `border-right`, right cells `border-left`, so
 * no seam ever doubles up. The hairlines live on the cells rather than the band
 * precisely so a hover fill runs the band's full height.
 *
 * Nothing in here is filled. A solid button would fight the steel, so Logout is
 * a cell like any other and its hover fills the whole cell with base accent —
 * the fill *is* the affordance. Every other interactive cell lights to paper at
 * .09 in place: no transforms, no border changes.
 *
 * Two things that break it if you get them wrong:
 *   - a cell with vertical padding: its hover stops short of the band edges;
 *   - a border-radius anywhere. The 6px live dot and the 15px badge are squares.
 *
 * Token mapping: steel `ind.tickerBg` (#1d2d3d), highlight `ind.tickerUp`
 * (#94bce3), fill `ind.accent` (#5980a6), paper `ind.tickerInk` (#f2f2f3),
 * hairline `ind.tickerRule`. Focus rings come from the stylesheet — they are
 * not restyled per cell.
 */
import _React, { useEffect, useMemo, useRef, useState } from 'react'
import { LogOut, Menu, X, Sun, Moon, ChevronDown, Building2 } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import NotificationDropdown from './NotificationDropdown'
import { useMinWidth } from '../hooks/useMinWidth.js'
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js'

/** The band's own height. Published as --app-header-h for the rail to hang off. */
const BAND_H = 60;

/** Two letters in the chip, the full name beside it. */
const LANG_SHORT = {
  en: 'EN', de: 'DE', fr: 'FR', jp: 'JA', kr: 'KO', th: 'TH', vn: 'VI', ru: 'RU', es: 'ES',
};

const PAPER_09 = 'rgba(242,242,243,.09)';

const pad2 = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ *
 * Band cell
 * ------------------------------------------------------------------ */

/**
 * One full-height cell. `side` decides which edge carries the hairline, so the
 * left group and the right group meet at the spacer without doubling a rule.
 * `onClick` makes it a button; without one it is a readout and does not light up.
 */
function BandCell({
  ind, side = 'left', onClick, width, padding = '0 18px', gap = 9,
  title, ariaLabel, hoverFill = PAPER_09, style, children, ...rest
}) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive
        ? { type: 'button', onClick, title, 'aria-label': ariaLabel || title }
        : { title })}
      {...rest}
      onMouseEnter={interactive ? (e) => { e.currentTarget.style.background = hoverFill; } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: width ? 'center' : 'flex-start',
        gap,
        flex: 'none',
        width,
        // Height comes from the band's stretch, never from padding. Vertical
        // padding here is what makes a hover fill stop short of the edges.
        alignSelf: 'stretch',
        padding: width ? 0 : padding,
        background: 'transparent',
        border: 'none',
        [side === 'left' ? 'borderRight' : 'borderLeft']: `1px solid ${ind.tickerRule}`,
        borderRadius: 0,
        color: ind.tickerInk,
        whiteSpace: 'nowrap',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background .15s ease',
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/** LIVE hh:mm:ss. The only thing in the band that moves. */
function LiveCell({ ind }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <BandCell ind={ind} gap={8}>
      {/* A square, deliberately. There is no radius in this band. */}
      <span aria-hidden="true" style={{ width: 6, height: 6, flex: 'none', display: 'block', background: ind.tickerUp }} />
      <span
        style={{
          fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.16em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        LIVE {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
      </span>
    </BandCell>
  );
}

/** The language cell: a VI chip, the language's own name, a chevron. No flag. */
function LanguageCell({ ind, showName }) {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const short = LANG_SHORT[currentLanguage] || String(currentLanguage || '').toUpperCase();
  const name = languages?.[currentLanguage]?.name || '';

  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none', alignSelf: 'stretch', display: 'flex' }}>
      <BandCell
        ind={ind}
        side="right"
        padding="0 16px"
        onClick={() => setOpen((v) => !v)}
        title={name}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          aria-hidden="true"
          style={{
            width: 22, height: 22, flex: 'none',
            display: 'grid', placeItems: 'center',
            border: '1px solid rgba(242,242,243,.45)', borderRadius: 0,
            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.06em',
            color: ind.tickerUp,
          }}
        >
          {short}
        </span>
        {showName && <span style={{ fontFamily: BODY, fontSize: 13 }}>{name}</span>}
        <ChevronDown size={13} strokeWidth={1.5} style={{ flex: 'none', opacity: 0.6 }} />
      </BandCell>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 60,
            minWidth: 184, background: ind.chrome, border: `1px solid ${ind.ink}`,
            borderRadius: 0, padding: 3,
          }}
        >
          {Object.values(languages || {}).map((lang) => {
            const active = lang.code === currentLanguage;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { changeLanguage(lang.code); setOpen(false); }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = ind.hover; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '6px 9px', border: 'none', borderRadius: 0, cursor: 'pointer',
                  background: active ? ind.accent : 'transparent',
                  color: active ? ind.accentInk : ind.ink,
                  fontFamily: active ? DISPLAY : BODY,
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  letterSpacing: active ? '.05em' : 0,
                  textTransform: active ? 'uppercase' : 'none',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 22, opacity: 0.65, fontFamily: DISPLAY, fontSize: 10, letterSpacing: '.12em' }}>
                  {LANG_SHORT[lang.code] || lang.code.toUpperCase()}
                </span>
                {lang.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

const Header = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const ind = getIndustry(isDarkMode);

  const isDesktop = useMinWidth(1024);
  const showWho = useMinWidth(760);
  const showLangName = useMinWidth(1180);
  const showLogoutLabel = useMinWidth(640);

  /*
   * The band is a fixed 60px, but the rail sizes itself off this number rather
   * than repeating it, so publish it and let one file own the value.
   */
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const publish = () => {
      document.documentElement.style.setProperty('--app-header-h', `${Math.round(el.offsetHeight)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.email || t('header.user', 'HR Team');

  /** "Welcome back" as a tracked label; the name is the value under it. */
  const welcomeLabel = useMemo(
    () => t('header.welcomeBack', 'Welcome back'),
    [t]
  );

  return (
    <header
      ref={headerRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: BAND_H,
        display: 'flex',
        alignItems: 'stretch',
        // No padding on the band itself — the cells are the geometry.
        padding: 0,
        background: ind.tickerBg,
        color: ind.tickerInk,
        fontFamily: BODY,
        /*
         * No `overflow:hidden` here, ever. The language listbox and the
         * notification panel are absolutely positioned inside this band, and
         * clipping the band clips them to 60px — they open, they are just
         * invisible, so both controls read as dead. Cells stay inside the band
         * by dropping out at their own breakpoints instead.
         */
      }}
    >
      {/* Drawer toggle. The rail is a drawer below lg, so this cell only
          exists there — no phantom control on the desktop band. */}
      {!isDesktop && (
        <BandCell
          ind={ind}
          width={52}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title={isMobileMenuOpen ? t('common.close', 'Close menu') : t('common.menu', 'Open menu')}
        >
          {isMobileMenuOpen
            ? <X size={18} strokeWidth={1.5} />
            : <Menu size={18} strokeWidth={1.5} />}
        </BandCell>
      )}

      {/* Brand — a 32px outlined square in accent-300, then the lockup. This is
          the only mark in the app; the rail carries none. */}
      <BandCell ind={ind} padding="0 22px" gap={11}>
        <span
          aria-hidden="true"
          style={{
            width: 32, height: 32, flex: 'none',
            display: 'grid', placeItems: 'center',
            border: `1px solid ${ind.tickerUp}`, borderRadius: 0,
            background: 'transparent', color: ind.tickerUp,
          }}
        >
          <Building2 size={19} strokeWidth={1.5} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 21, letterSpacing: '.07em' }}>
            ICUE
          </span>
          <span
            style={{
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 9, letterSpacing: '.2em',
              textTransform: 'uppercase', color: ind.tickerUp, marginTop: 2,
            }}
          >
            {t('header.consoleTag', 'Workforce Console')}
          </span>
        </span>
      </BandCell>

      <LiveCell ind={ind} />

      {/* Session — the label states the greeting, the value states who. It sits
          in the left group, where the org readout used to: the band names the
          person, not the tenant, and there is only one org in this build. */}
      {showWho && (
        <BandCell ind={ind} title={displayName}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0 }}>
            <span
              style={{
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, letterSpacing: '.18em',
                textTransform: 'uppercase', color: 'rgba(242,242,243,.6)', lineHeight: 1,
              }}
            >
              {welcomeLabel}
            </span>
            <span
              style={{
                fontFamily: BODY, fontSize: 13, lineHeight: 1,
                maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </span>
          </span>
        </BandCell>
      )}

      {/* The gap. Everything after it reads right-aligned. */}
      <div style={{ flex: 1, minWidth: 12 }} />

      <LanguageCell ind={ind} showName={showLangName} />

      <BandCell
        ind={ind}
        side="right"
        width={52}
        onClick={toggleTheme}
        title={isDarkMode ? t('theme.light', 'Light mode') : t('theme.dark', 'Dark mode')}
        style={{ color: 'rgba(242,242,243,.8)' }}
      >
        {isDarkMode ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
      </BandCell>

      {/* Its own cell rule, then the trigger fills it. The badge is the
          brightest object in the band. */}
      <div style={{ alignSelf: 'stretch', display: 'flex', flex: 'none', borderLeft: `1px solid ${ind.tickerRule}` }}>
        <NotificationDropdown variant="band" />
      </div>

      {/* Logout. Not a button object — its hover fills the cell with base
          accent instead, which is the only fill anywhere in the band. */}
      <BandCell
        ind={ind}
        side="right"
        padding="0 20px"
        gap={8}
        onClick={handleLogout}
        title={t('header.logout', 'Logout')}
        hoverFill={ind.accent}
      >
        <LogOut size={15} strokeWidth={1.5} style={{ flex: 'none' }} />
        {showLogoutLabel && (
          <span
            style={{
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 12,
              letterSpacing: '.1em', textTransform: 'uppercase',
            }}
          >
            {t('header.logout', 'Logout')}
          </span>
        )}
      </BandCell>
    </header>
  );
};

export default Header;
