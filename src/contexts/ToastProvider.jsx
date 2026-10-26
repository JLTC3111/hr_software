import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SwipeToast from '../components/ui/swipe-toast.jsx';
import { useLanguage } from './LanguageContext.jsx';
import { ToastContext } from './ToastContext.js';

/** One stack for feedback from every screen; each toast owns its lifetime. */
export function ToastProvider({ children, maxVisible = 4 }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const nextId = useRef(0);
  const visibleLimit = Math.max(1, Math.floor(Number(maxVisible) || 4));
  const toast = useCallback(options => {
    const id = ++nextId.current;
    setItems(current => [...current, { ...(typeof options === 'string' ? { title: options } : options), id, open: true }]);
    return id;
  }, []);
  const dismissToast = useCallback(id => {
    // Queued items have no mounted exit animation to remove them later.
    setItems(current => current.flatMap((item, index) => id == null || item.id === id
      ? index < visibleLimit ? [{ ...item, open: false }] : []
      : [item]));
  }, [visibleLimit]);
  const removeToast = useCallback(id => setItems(current => current.filter(item => item.id !== id)), []);
  const value = useMemo(() => ({ toast, dismissToast }), [toast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="swipe-toast-viewport" role="region" aria-label={t('notifications.title', 'Notifications')}>
          {items.slice(0, visibleLimit).map(({ id, onClose, ...options }) => (
            <SwipeToast key={id} {...options} inline onClose={reason => {
              removeToast(id);
              onClose?.(reason);
            }} />
          ))}
        </div>, document.body
      )}
    </ToastContext.Provider>
  );
}
