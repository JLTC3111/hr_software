import { useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useLanguage } from './LanguageContext.jsx';
import { setManualTranslations } from '../services/translateService.js';
import { buildTranslationIndex, fetchLocaleTranslations } from '../services/ugcTranslationService.js';

// Translation reads depend on the signed-in HR identity. Clear the previous
// reader's confidential overrides on logout or a permissions/identity change.
export default function ManualTranslationLoader() {
  const { isAuthenticated, user, session } = useAuth();
  const { currentLanguage, manualTranslationsVersion } = useLanguage();
  const scope = isAuthenticated && user ? [session?.user?.id, user.id, user.role, user.department, user.employeeId].join(':') : '';
  useEffect(() => {
    let cancelled = false;
    setManualTranslations(currentLanguage, null);
    if (scope) {
      fetchLocaleTranslations(currentLanguage).then(({ success, data }) => {
        if (!cancelled) setManualTranslations(currentLanguage, buildTranslationIndex(success ? data : []));
      }).catch(() => { if (!cancelled) setManualTranslations(currentLanguage, null); });
    }
    return () => { cancelled = true; setManualTranslations(null, null); };
  }, [scope, currentLanguage, manualTranslationsVersion]);
  return null;
}
