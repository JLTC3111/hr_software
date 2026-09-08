import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { SlidingNumber } from './motion-primitives';
import { getIdleDurationMs } from '../utils/activityTracker.js';
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js';
import { Blueprint, Btn, Kicker, ColumnHeading } from './ui/industry.jsx';

/**
 * The last 60 seconds of an idle session.
 *
 * Until now the idle timeout could not fire at all, so warning about it was
 * moot and `onWarning` only reached a console.warn. Now that it does fire, an
 * unannounced sign-out is the difference between a security policy and a bug
 * report — this is the announcement.
 *
 * The countdown is read from the shared activity clock rather than from a local
 * deadline, so it always agrees with the hook that will actually sign the user
 * out, including when something extends the session underneath it.
 *
 * Any real interaction anywhere in the app counts as activity and cancels the
 * warning through the usual path; the buttons here are the explicit version of
 * that, and "stay" additionally renews the token (see AuthContext).
 */
const IdleWarningModal = ({ open, timeoutMs, onStay, onSignOut }) => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { t } = useLanguage();

  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, timeoutMs - getIdleDurationMs())
  );

  useEffect(() => {
    if (!open) return undefined;

    const read = () => setRemainingMs(Math.max(0, timeoutMs - getIdleDurationMs()));
    read();
    const id = globalThis.setInterval(read, 250);
    return () => globalThis.clearInterval(id);
  }, [open, timeoutMs]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onStay?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onStay]);

  if (!open || typeof document === 'undefined') return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds <= 10;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(29,31,32,.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onStay}
    >
      <div onClick={(event) => event.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
        <Blueprint
          ind={ind}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-warning-title"
          aria-describedby="idle-warning-body"
          style={{
            background: ind.ground,
            padding: '22px 22px 18px',
            border: urgent ? `1px solid ${ind.ink}` : undefined,
            textAlign: 'center',
            color: ind.ink,
            fontFamily: BODY,
          }}
        >
          <div
            style={{
              width: 40, height: 40, margin: '0 auto 14px',
              display: 'grid', placeItems: 'center',
              border: `1px solid ${urgent ? ind.ink : ind.hairline}`,
              color: urgent ? ind.ink : ind.inkMuted,
            }}
          >
            <ShieldAlert size={18} strokeWidth={1.5} />
          </div>

          <ColumnHeading ind={ind}>
            <span id="idle-warning-title">{t('session.idleWarningTitle', 'Still there?')}</span>
          </ColumnHeading>

          <p id="idle-warning-body" style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, margin: '10px 0 18px', lineHeight: 1.55 }}>
            {t(
              'session.idleWarningBody',
              "You've been inactive for a while. For security, we'll sign you out automatically."
            )}
          </p>

          <Kicker ind={ind} color={ind.inkMuted}>
            {t('session.idleWarningCountdown', 'Signing out in')}
          </Kicker>
          <div
            className="flex items-baseline justify-center"
            style={{ gap: 8, margin: '8px 0 22px', ...figure(44, urgent ? ind.ink : ind.inkMuted) }}
          >
            <span aria-hidden="true" className="flex items-baseline">
              {minutes > 0 && (
                <>
                  <SlidingNumber value={minutes} replayOnHover={false} />
                  <span>:</span>
                  <SlidingNumber value={seconds} padStart replayOnHover={false} />
                </>
              )}
              {minutes === 0 && <SlidingNumber value={seconds} replayOnHover={false} />}
            </span>
            {minutes === 0 && (
              <span aria-hidden="true" style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: ind.inkMuted }}>
                {t('session.idleWarningSeconds', 'seconds')}
              </span>
            )}
            <span className="sr-only" aria-live="assertive">
              {totalSeconds}
            </span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 8 }}>
            <Btn
              ind={ind}
              onClick={onSignOut}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderColor: ind.ink }}
            >
              <LogOut size={13} strokeWidth={1.5} />
              {t('session.signOutNow', 'Sign out now')}
            </Btn>
            <Btn
              ind={ind}
              variant="primary"
              autoFocus
              onClick={onStay}
              style={{ flex: 1 }}
            >
              {t('session.staySignedIn', 'Stay signed in')}
            </Btn>
          </div>
        </Blueprint>
      </div>
    </div>,
    document.body
  );
};

export default IdleWarningModal;
