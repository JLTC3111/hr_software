import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { SlidingNumber } from './motion-primitives';
import { BorderBeam } from './ui/border-beam';
import { getIdleDurationMs } from '../utils/activityTracker.js';

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
  const { isDarkMode, text } = useTheme();
  const { t } = useLanguage();
  const stayButtonRef = useRef(null);

  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, timeoutMs - getIdleDurationMs())
  );

  useEffect(() => {
    if (!open) return undefined;

    const read = () => setRemainingMs(Math.max(0, timeoutMs - getIdleDurationMs()));
    read();
    // Faster than the second it displays, so the number is never a stale tick
    // behind the sign-out it is counting towards.
    const id = globalThis.setInterval(read, 250);
    return () => globalThis.clearInterval(id);
  }, [open, timeoutMs]);

  // Escape is the keyboard form of "I'm still here" — and, being a keydown, it
  // registers as activity on its own anyway.
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

  useEffect(() => {
    if (!open) return;
    // Focus the safe action, not the destructive one.
    stayButtonRef.current?.focus();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds <= 10;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onStay}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-body"
        onClick={(event) => event.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl p-8 shadow-2xl ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        <BorderBeam
          size={70}
          duration={urgent ? 3 : 6}
          borderWidth={1.5}
          colorFrom={urgent ? '#f87171' : '#fbbf24'}
          colorTo={urgent ? '#dc2626' : '#f59e0b'}
        />

        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full ${
              urgent
                ? isDarkMode ? 'bg-red-900/40' : 'bg-red-100'
                : isDarkMode ? 'bg-amber-900/40' : 'bg-amber-100'
            }`}
          >
            <ShieldAlert
              className={`h-7 w-7 ${
                urgent
                  ? isDarkMode ? 'text-red-400' : 'text-red-600'
                  : isDarkMode ? 'text-amber-400' : 'text-amber-600'
              }`}
            />
          </div>

          <h2 id="idle-warning-title" className={`mb-2 text-2xl font-bold ${text.primary}`}>
            {t('session.idleWarningTitle', 'Still there?')}
          </h2>

          <p id="idle-warning-body" className={`mb-6 text-sm leading-relaxed ${text.secondary}`}>
            {t(
              'session.idleWarningBody',
              "You've been inactive for a while. For security, we'll sign you out automatically."
            )}
          </p>

          {/*
            aria-live on a wrapper that carries the plain number: SlidingNumber
            renders ten stacked digits per place, so a screen reader following
            the visual markup would read the whole wheel.
          */}
          <p className={`mb-1 text-xs uppercase tracking-wider ${text.secondary}`}>
            {t('session.idleWarningCountdown', 'Signing out in')}
          </p>
          <div
            className={`mb-7 flex items-baseline gap-2 text-5xl font-bold tabular-nums ${
              urgent
                ? isDarkMode ? 'text-red-400' : 'text-red-600'
                : text.primary
            }`}
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
              <span aria-hidden="true" className={`text-base font-medium ${text.secondary}`}>
                {t('session.idleWarningSeconds', 'seconds')}
              </span>
            )}
            <span className="sr-only" aria-live="assertive">
              {totalSeconds}
            </span>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row-reverse">
            <button
              ref={stayButtonRef}
              type="button"
              onClick={onStay}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('session.staySignedIn', 'Stay signed in')}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
                isDarkMode
                  ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LogOut className="h-4 w-4" />
              {t('session.signOutNow', 'Sign out now')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IdleWarningModal;
