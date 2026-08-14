import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Btn, Kicker } from './ui/industry.jsx';
import { isChunkLoadError, recoverStaleChunk } from '../utils/lazyWithRetry.js';

/**
 * Error boundary for the routed page only.
 *
 * The app's other boundary is at the root, above AuthProvider, so anything a
 * screen throws replaced the whole application with a full-page error — header,
 * rail and all. That is what "the app just crashes" looks like from the outside:
 * one failed page and there is no way back except a reload.
 *
 * This one sits inside the shell, so a screen that fails takes only its own
 * pane with it and the rail is still there to navigate away with. It is keyed on
 * the pathname, which means leaving the broken route clears the error by itself.
 */
class RouteErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by RouteErrorBoundary:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { ind, t } = this.props;

    return (
      <Blueprint ind={ind} style={{ background: ind.ground, padding: '20px 22px', maxWidth: 620 }}>
        <div className="flex items-start" style={{ gap: 12 }}>
          <AlertCircle size={18} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
            <p style={{ fontFamily: BODY, fontSize: 14, color: ind.ink, margin: '6px 0 0', lineHeight: 1.5 }}>
              {t('routeError.message', 'This screen could not be opened. The rest of the app is still working — pick another page from the menu, or reload.')}
            </p>

            {/* Shown in production too. This boundary exists because a failure
                here used to be invisible, and the message is the only thing
                that tells anyone which failure it was. */}
            <p
              style={{
                fontFamily: DISPLAY,
                fontSize: 12,
                letterSpacing: '.02em',
                color: ind.inkMuted,
                margin: '10px 0 0',
                wordBreak: 'break-word',
              }}
            >
              {error?.message || String(error)}
            </p>

            <Btn
              ind={ind}
              variant="primary"
              onClick={() => {
                if (isChunkLoadError(error)) {
                  recoverStaleChunk(error, { force: true });
                  return;
                }
                globalThis.location.reload();
              }}
              style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              {t('common.reload', 'Reload')}
            </Btn>
          </div>
        </div>
      </Blueprint>
    );
  }
}

const RouteErrorBoundary = ({ children }) => {
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const ind = getIndustry(isDarkMode);

  // Remount on navigation: a boundary that has caught stays caught, and the
  // next route is very often fine.
  return (
    <RouteErrorBoundaryInner key={pathname} ind={ind} t={t}>
      {children}
    </RouteErrorBoundaryInner>
  );
};

export default RouteErrorBoundary;
