import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { BODY, DISPLAY, getIndustry } from '../../theme/industry.js';
import './swipe-toast.css';

/**
 * Swipe Toast, adapted to the platform's Industry theme. `inline` lets a
 * parent stack instances; otherwise the toast is portalled above the page.
 * onClose receives timeout, swipe, close, escape, action or dismiss, after exit.
 */
export default function SwipeToast({
  open = true, onClose, title, description, actionLabel, onAction,
  background, color, fuseColor, width = 356, radius = 0,
  slideMs = 400, settleBounce = 0.2, swipeDistance = 40,
  duration = 4000, fuse = 'bottom', pauseOnHover = true,
  closeButton = true, inline = false, variant = 'info',
}) {
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();
  const ind = getIndustry(isDarkMode);
  const reducedMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [actionPending, setActionPending] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [direction, setDirection] = useState(1);
  const closingRef = useRef(false);
  const notifiedRef = useRef(!open);
  const reasonRef = useRef(null);
  const callbackRef = useRef(onClose);
  const remainingRef = useRef(duration);
  const mountedRef = useRef(true);
  const actionInFlightRef = useRef(false);
  const openRef = useRef(open);
  callbackRef.current = onClose;
  openRef.current = open;
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 150], reducedMotion ? [0, 0] : [-4, 4]);
  const paused = (pauseOnHover && hovered) || focused || dragging || hidden || actionPending || closing;
  const timeoutMs = Math.max(0, Number(duration) || 0);

  const requestClose = useCallback((reason) => {
    if (!openRef.current || closingRef.current) return;
    closingRef.current = true;
    reasonRef.current = reason;
    setClosing(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    remainingRef.current = timeoutMs;
    if (open) {
      closingRef.current = false;
      notifiedRef.current = false;
      reasonRef.current = null;
      setClosing(false);
      setActionFailed(false);
      setHovered(false);
      setFocused(false);
      setDragging(false);
      x.set(0);
    }
  }, [open, timeoutMs, x]);

  useEffect(() => {
    if (!open || paused || !timeoutMs) return undefined;
    const started = performance.now();
    const timer = setTimeout(() => requestClose('timeout'), remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - started));
    };
  }, [open, paused, timeoutMs, requestClose]);

  const finishClose = () => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    callbackRef.current?.(reasonRef.current || 'dismiss');
  };

  const handleAction = async () => {
    if (actionInFlightRef.current || closingRef.current) return;
    actionInFlightRef.current = true;
    setActionPending(true);
    setActionFailed(false);
    try {
      await onAction();
      if (mountedRef.current) requestClose('action');
    } catch {
      // Failed actions stay available to retry; never report an undo as done.
      if (mountedRef.current) setActionFailed(true);
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) setActionPending(false);
    }
  };

  const Icon = variant === 'error' || variant === 'warning' ? AlertCircle : variant === 'success' ? CheckCircle2 : Info;
  const accent = fuseColor || (variant === 'error' ? ind.ink : ind.accent);
  const content = (
    <AnimatePresence onExitComplete={finishClose}>
      {open && !closing && (
        <Motion.div
          key="toast"
          layout="position"
          className="swipe-toast-shell"
          initial={{ opacity: 0, x: reducedMotion ? 0 : '110%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reducedMotion ? 0 : `${direction * 110}%`, transition: { duration: reducedMotion ? 0.1 : 0.2 } }}
          transition={{ type: 'spring', duration: Math.max(0.1, slideMs / 1000), bounce: reducedMotion ? 0 : Math.max(0, Math.min(0.8, settleBounce)) }}
          style={{ width, maxWidth: '100%' }}
        >
          <Motion.div
            data-swipe-toast
            data-variant={variant}
            role={variant === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            tabIndex={0}
            className="swipe-toast"
            drag="x"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            dragSnapToOrigin
            dragMomentum={false}
            onPointerDown={event => {
              if (event.button !== 0 || actionPending || event.target.closest('button, a, input, textarea, select')) return;
              dragControls.start(event);
            }}
            onDragStart={() => setDragging(true)}
            onDragEnd={(_event, info) => {
              setDragging(false);
              if (Math.abs(info.offset.x) >= Math.max(1, swipeDistance)) {
                setDirection(info.offset.x < 0 ? -1 : 1);
                requestClose('swipe');
              }
            }}
            onPointerCancel={() => setDragging(false)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                requestClose('escape');
              }
            }}
            style={{
              x, rotate, background: background || ind.chrome, color: color || ind.ink,
              borderColor: ind.hairline, borderRadius: radius, fontFamily: BODY,
              '--swipe-toast-accent': accent, '--swipe-toast-focus': ind.accent,
            }}
          >
            <Icon size={17} strokeWidth={1.5} aria-hidden="true" className="swipe-toast-icon" />
            <div className="swipe-toast-copy">
              {title && <div className="swipe-toast-title" style={{ fontFamily: DISPLAY }}>{title}</div>}
              {description && <div className="swipe-toast-description">{description}</div>}
              {actionFailed && <div role="alert" className="swipe-toast-description">{t('toast.actionFailed', 'Could not complete the action. Please try again.')}</div>}
            </div>
            {actionLabel && typeof onAction === 'function' && (
              <button type="button" className="swipe-toast-action" onClick={handleAction} disabled={actionPending}
                style={{ fontFamily: DISPLAY, borderColor: ind.hairline }}>
                {actionPending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                {actionLabel}
              </button>
            )}
            {closeButton && (
              <button type="button" className="swipe-toast-close" aria-label={t('notifications.dismiss', 'Dismiss')}
                onClick={() => requestClose('close')}><X size={14} strokeWidth={1.5} aria-hidden="true" /></button>
            )}
            {timeoutMs > 0 && (fuse === 'bottom' || fuse === 'top') && (
              <span key={timeoutMs} aria-hidden="true" className={`swipe-toast-fuse swipe-toast-fuse--${fuse}`}
                style={{ animationDuration: `${timeoutMs}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
            )}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );

  return inline ? content : typeof document !== 'undefined' ? createPortal(
    <div className="swipe-toast-viewport" style={{ width }}>{content}</div>, document.body
  ) : null;
}
