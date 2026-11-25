import _React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Languages,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../utils/demoHelper';
import { ShinyButton } from './ui/shiny-button';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Tag, Btn, Kicker, ColumnHeading, TickerCell, LiveClock } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';
import {
  ENTITY_TYPES,
  TRANSLATABLE_ENTITIES,
  buildTranslationIndex,
  deleteTranslation,
  fetchLocaleTranslations,
  fetchRecordTranslations,
  fetchTranslationCoverage,
  fetchTranslatableRecords,
  saveTranslationBatch,
  isTranslationStoreAvailable,
} from '../services/ugcTranslationService';
import {
  isLocalTranslationSupported,
  prepareTranslation,
  setManualTranslations,
  translateText,
  translationAvailability,
} from '../services/translateService';
import { isTranslationEditor } from '../utils/translationAccess';
import { publishTranslationQueueCount } from '../utils/translationQueueStatus.js';
import {
  buildStudioQueue,
  fieldFilterKey,
  filterStudioQueue,
  indexStudioTranslations,
  isOutdatedTranslation,
  nextMissingStudioTranslation,
  searchStudioQueue,
} from '../utils/translationStudioQueue.js';

/**
 * Translation Studio — the full-page editor for hand-authored translations of
 * user-generated content.
 *
 * It is deliberately not a modal. The work is comparative (source text on one
 * side, nine target languages on the other) and long-running: an editor works
 * through a queue of dozens of strings in a sitting, and a dialog that traps
 * focus and hides the app behind a scrim is the wrong container for that.
 *
 * The queue is assembled from the records the app writes — tasks, personal
 * goals and their comments/check-ins, performance reviews, leave requests — so nothing
 * has to be re-entered here. Saved translations land in hr_ugc_translations and
 * outrank the on-device machine translation everywhere UGC is rendered.
 */

const LEFT_PANEL_WIDTH_KEY = 'translation-studio-left-panel-width';
const DEFAULT_LEFT_PANEL_WIDTH = 320;
const MIN_LEFT_PANEL_WIDTH = 260;
const MAX_LEFT_PANEL_WIDTH = 560;

const FIELD_FILTER_KEYS = ENTITY_TYPES.flatMap((entityType) =>
  TRANSLATABLE_ENTITIES[entityType].fields.map((field) => fieldFilterKey(entityType, field))
);
const allFieldFilters = () => new Set(FIELD_FILTER_KEYS);

const initialLeftPanelWidth = () => {
  if (typeof localStorage === 'undefined') return DEFAULT_LEFT_PANEL_WIDTH;
  try {
    const raw = localStorage.getItem(LEFT_PANEL_WIDTH_KEY);
    if (raw == null) return DEFAULT_LEFT_PANEL_WIDTH;
    const saved = Number(raw);
    return Number.isFinite(saved)
      ? Math.min(MAX_LEFT_PANEL_WIDTH, Math.max(MIN_LEFT_PANEL_WIDTH, saved))
      : DEFAULT_LEFT_PANEL_WIDTH;
  } catch {
    return DEFAULT_LEFT_PANEL_WIDTH;
  }
};

const persistLeftPanelWidth = (width) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(Math.round(width)));
  } catch {
    /* private browsing / disabled storage */
  }
};

const TranslationStudio = () => {
  const { t, currentLanguage, refreshManualTranslations } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { user } = useAuth();

  const demo = isDemoMode();
  const canEdit = isTranslationEditor(user);

  // ---- queue ----------------------------------------------------------------
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [storeReady, setStoreReady] = useState(true);
  // field key → locale → persisted translation and its source snapshot
  const [coverage, setCoverage] = useState(new Map());

  // ---- filters --------------------------------------------------------------
  const [sources, setSources] = useState(() => new Set(ENTITY_TYPES));
  const [selectedFields, setSelectedFields] = useState(allFieldFilters);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('missing');
  const [language, setLanguage] = useState('');

  // ---- layout ---------------------------------------------------------------
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialLeftPanelWidth);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const leftPanelRef = useRef(null);
  const leftPanelWidthRef = useRef(leftPanelWidth);
  const queueListRef = useRef(null);

  // ---- selection & editor ---------------------------------------------------
  const [selection, setSelection] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const editorFields = useRef(new Map());
  // { [locale]: { body, sourceText, provider } } for the selected entry.
  const [stored, setStored] = useState({});
  const [drafts, setDrafts] = useState({});
  const [editorState, setEditorState] = useState('idle'); // idle | loading | ready | error
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind, message }
  const [drafting, setDrafting] = useState(null); // locale currently machine-drafting
  const [suggestingAll, setSuggestingAll] = useState(false);
  // locale → 'available' | 'downloadable' | 'unavailable', so the UI can warn
  // that a suggestion will pull a model down before the user waits on it.
  const [availability, setAvailability] = useState({});
  // 0..1 while a language pack downloads, else null.
  const [downloadProgress, setDownloadProgress] = useState(null);

  const feedbackTimer = useRef(null);

  const locales = useMemo(
    () => Object.values(SUPPORTED_LANGUAGES).map((l) => l.code),
    []
  );
  const editorWorking = busy || Boolean(drafting) || suggestingAll;

  const flash = useCallback((kind, message) => {
    setFeedback({ kind, message });
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
  }, []);

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  useEffect(() => {
    leftPanelWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);

  useEffect(() => {
    if (!isResizingLeftPanel || typeof window === 'undefined') return undefined;

    const panelLeft = leftPanelRef.current?.getBoundingClientRect().left;
    if (!Number.isFinite(panelLeft)) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event) => {
      const viewportLimit = Math.max(MIN_LEFT_PANEL_WIDTH, window.innerWidth - 440);
      const next = Math.min(
        MAX_LEFT_PANEL_WIDTH,
        viewportLimit,
        Math.max(MIN_LEFT_PANEL_WIDTH, event.clientX - panelLeft)
      );
      leftPanelWidthRef.current = next;
      setLeftPanelWidth(next);
    };

    const handlePointerUp = () => {
      persistLeftPanelWidth(leftPanelWidthRef.current);
      setIsResizingLeftPanel(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingLeftPanel]);

  // ---------------------------------------------------------------------------
  // Queue + coverage
  // ---------------------------------------------------------------------------
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const [records, translations] = await Promise.all([
      fetchTranslatableRecords(),
      fetchTranslationCoverage(),
    ]);

    if (!records.success) {
      setLoadError(records.error || 'load-failed');
      setEntries([]);
      setLoading(false);
      return;
    }

    // Never turn a failed coverage read into a plausible-looking 0/N or stale
    // fraction. The translations table being absent has its own configuration
    // warning; every other failure makes the queue unavailable until refreshed.
    if (!translations.success && !translations.notConfigured) {
      setLoadError(translations.error || 'coverage-load-failed');
      setEntries([]);
      setLoading(false);
      return;
    }

    setEntries(records.data);
    setCoverage(indexStudioTranslations(translations.data || [], locales));
    // The queue reads the source tables, which exist regardless; only the
    // translations table depends on migration 018. So the Studio can be fully
    // populated and still have nowhere to save to — say so explicitly rather
    // than letting the first Save fail.
    setStoreReady(isTranslationStoreAvailable());
    setLoading(false);
  }, [locales]);

  useEffect(() => {
    // Non-admins get the access-denied panel, so the source queue
    // must not be fetched for them at all.
    if (demo || !canEdit) {
      setLoading(false);
      return;
    }
    loadQueue();
  }, [demo, canEdit, loadQueue]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const queue = useMemo(() => buildStudioQueue(entries, coverage, locales), [entries, coverage, locales]);
  const searchMatches = useMemo(() => searchStudioQueue(queue.fields, coverage, query), [queue, coverage, query]);
  const filters = useMemo(() => ({ status, sources, fields: selectedFields, language }), [status, sources, selectedFields, language]);
  const visible = useMemo(
    () => filterStudioQueue(searchMatches, filters),
    [searchMatches, filters]
  );
  const selected = queue.fields.get(selection?.key);

  const clearAdvancedFilters = () => {
    setSources(new Set(ENTITY_TYPES));
    setSelectedFields(allFieldFilters());
    setLanguage('');
  };

  const resetFilters = () => {
    clearAdvancedFilters();
    setQuery('');
    setStatus('missing');
  };

  const openSourceQueue = (entityType, nextStatus) => {
    clearAdvancedFilters();
    setSources(new Set([entityType]));
    setQuery('');
    setStatus(nextStatus);
    const list = queueListRef.current;
    if (list) {
      list.scrollTop = 0;
      list.focus();
    }
  };

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------
  const selectEntry = (entry, locale) => {
    if (selection?.key !== entry.key || editorState === 'error') {
      const { key, entityType, entityId } = entry;
      setSelection({ key, entityType, entityId });
      setEditorState('loading');
      setFeedback(null);
    }
    if (locale && !entry.missingLocales.includes(locale)) setMissingOnly(false);
    setFocusRequest(locale ? { key: entry.key, locale } : null);
  };

  const updateFieldCoverage = useCallback((key, translations) => {
    setCoverage((prev) => new Map(prev).set(key, translations));
  }, []);

  useEffect(() => {
    if (!selection) return undefined;

    let cancelled = false;

    fetchRecordTranslations(selection.entityType, selection.entityId)
      .then(({ success, data }) => {
        if (cancelled) return;
        if (!success) {
          setEditorState('error');
          return;
        }

        const translations = indexStudioTranslations(data || [], locales).get(selection.key) || new Map();
        const next = Object.fromEntries(translations);
        setStored(next);
        setDrafts(next);
        updateFieldCoverage(selection.key, translations);
        setEditorState('ready');
      })
      .catch(() => {
        if (!cancelled) setEditorState('error');
      });

    return () => { cancelled = true; };
  }, [selection, locales, updateFieldCoverage]);

  useEffect(() => {
    if (editorState === 'ready' && focusRequest && focusRequest.key === selection?.key) {
      const field = editorFields.current.get(focusRequest.locale);
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ block: 'center' });
    }
  }, [focusRequest, selection, editorState]);

  const updateDraft = useCallback((locale, body) => {
    setFeedback(null);
    setDrafts((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] || {}), body, provider: 'manual' },
    }));
  }, []);

  const dirtyLocales = useMemo(() => {
    const out = [];
    locales.forEach((locale) => {
      const before = (stored[locale]?.body || '').trim();
      const after = (drafts[locale]?.body || '').trim();
      if (before !== after) out.push(locale);
    });
    return out;
  }, [stored, drafts, locales]);

  /**
   * Fills one locale from the on-device model as a starting point. The result
   * is only a draft in the textarea — it is not saved, and never reaches the
   * database, until a human has read it and pressed Save.
   */
  const machineDraft = useCallback(async (locale) => {
    if (!selected) return;
    setDrafting(locale);
    try {
      // Chrome only downloads language packs under transient user activation,
      // which this click still has.
      await prepareTranslation(locale, [currentLanguage, 'en'], setDownloadProgress);
      const out = await translateText(selected.sourceText, locale);
      if (out && out !== selected.sourceText) {
        updateDraft(locale, out);
      } else {
        flash('warn', t('translationStudio.draftUnavailable', 'No on-device model for this language yet.'));
      }
    } finally {
      setDrafting(null);
      setDownloadProgress(null);
    }
  }, [selected, currentLanguage, updateDraft, flash, t]);

  /**
   * Machine-translates the selected string into every locale in one pass.
   *
   * `overwrite: false` (Suggest) skips any box that already has text, and the
   * skip is re-checked inside the state updater — so a slow suggestion that
   * resolves after the editor started typing still loses. `overwrite: true`
   * (Translate all) replaces every box, and is gated behind a confirm when
   * there is anything to lose.
   *
   * Neither writes to the database. These are drafts on screen until a human
   * reads them and presses Save, so a stored translation is always something a
   * person signed off on.
   */
  const runBulkTranslate = useCallback(async ({ overwrite }) => {
    if (!selected) return;

    // The UI language is not necessarily the language of the source text. Keep
    // every locale in the pass so switching the app to Vietnamese cannot hide
    // Vietnamese while translating an English task. The detected source locale
    // naturally produces unchanged output and is skipped below.
    const targets = locales;
    const wouldReplace = overwrite
      ? targets.filter((locale) => (drafts[locale]?.body || '').trim()).length
      : 0;

    if (wouldReplace > 0) {
      const message = t(
        'translationStudio.confirmTranslateAll',
        'Replace all existing translations for this text with machine output? Nothing is saved until you press Save.'
      );
      if (!window.confirm(`${message} (${wouldReplace})`)) return;
    }

    if (overwrite) setMissingOnly(false);
    setSuggestingAll(true);
    let filled = 0;

    try {
      for (const locale of targets) {
        if (!overwrite && (drafts[locale]?.body || '').trim()) continue;

        await prepareTranslation(locale, [currentLanguage, 'en'], setDownloadProgress);
        const out = await translateText(selected.sourceText, locale);
        // Output identical to the input means the model had nothing to
        // contribute for this pair; leave whatever is there alone.
        if (!out || out === selected.sourceText) continue;

        filled += 1;
        setFeedback(null);
        setDrafts((prev) => (
          !overwrite && (prev[locale]?.body || '').trim()
            ? prev
            : { ...prev, [locale]: { ...(prev[locale] || {}), body: out, provider: 'manual' } }
        ));
      }

      flash(
        filled ? 'ok' : 'warn',
        filled
          ? `${t('translationStudio.suggested', 'Suggestions filled in')} (${filled})`
          : t('translationStudio.draftUnavailable', 'No on-device model for this language yet.')
      );
    } finally {
      setSuggestingAll(false);
      setDownloadProgress(null);
    }
  }, [selected, locales, currentLanguage, drafts, flash, t]);

  const suggestAll = useCallback(
    () => runBulkTranslate({ overwrite: false }),
    [runBulkTranslate]
  );
  const translateAll = useCallback(
    () => runBulkTranslate({ overwrite: true }),
    [runBulkTranslate]
  );

  // What each language would cost right now. `drafting` and `suggestingAll` are
  // deps on purpose: they are not read here, they are the signal to re-probe —
  // a pack pulled down for one string makes every later one instant, and the
  // download hint has to stop showing once that happens.
  useEffect(() => {
    if (!selected || !isLocalTranslationSupported()) return undefined;

    let cancelled = false;
    Promise.all(
      locales
        .map(async (locale) => [locale, await translationAvailability(locale, currentLanguage)])
    ).then((pairs) => {
      if (!cancelled) setAvailability(Object.fromEntries(pairs));
    });

    return () => { cancelled = true; };
  }, [selected, locales, currentLanguage, drafting, suggestingAll]);

  /**
   * Rebuilds the app-wide override index after a write, so an edit made here is
   * visible on every other screen without a reload.
   */
  const reinstallActiveIndex = useCallback(async () => {
    const { success, data } = await fetchLocaleTranslations(currentLanguage);
    if (success) setManualTranslations(currentLanguage, buildTranslationIndex(data));
    refreshManualTranslations?.();
  }, [currentLanguage, refreshManualTranslations]);

  const canWrite = storeReady && !loading && !loadError && editorState === 'ready' && !editorWorking;
  const canSave = canWrite && dirtyLocales.length > 0;
  const handleSave = async (advance = false) => {
    if (!selected || !canSave) return;
    setBusy(true);

    const result = await saveTranslationBatch(
      dirtyLocales.map((locale) => ({
        entityType: selected.entityType,
        entityId: selected.entityId,
        field: selected.field,
        locale,
        body: drafts[locale]?.body || '',
        sourceText: selected.sourceText,
      })),
      user?.id || null
    );

    if (result.success) {
      const next = { ...stored };
      dirtyLocales.forEach((locale) => {
        const body = (drafts[locale]?.body || '').trim();
        if (body) {
          next[locale] = { body, sourceText: selected.sourceText, provider: 'manual' };
        } else {
          delete next[locale];
        }
      });
      setStored(next);
      const saved = new Map(Object.entries(next));
      updateFieldCoverage(selected.key, saved);

      let savedMessage = t('translationStudio.saved', 'Saved');
      if (advance) {
        const nextCoverage = new Map(coverage).set(selected.key, saved);
        const updatedQueue = buildStudioQueue(entries, nextCoverage, locales);
        const remaining = filterStudioQueue(searchStudioQueue(updatedQueue.fields, nextCoverage, query), filters);
        const target = nextMissingStudioTranslation(visible, remaining, selected.key, language);
        if (target) selectEntry(updatedQueue.fields.get(target.key), target.locale);
        else savedMessage = t('translationStudio.savedNoMoreMissing', 'Saved. No more missing translations match these filters.');
      }

      await reinstallActiveIndex();
      flash('ok', savedMessage);
    } else {
      console.error('Translation save failed:', result.error);
      flash('error', t('translationStudio.saveError', 'Could not save'));
    }

    setBusy(false);
  };

  const handleDelete = async (locale) => {
    if (!selected || !canWrite) return;
    setBusy(true);

    const result = await deleteTranslation({
      entityType: selected.entityType,
      entityId: selected.entityId,
      field: selected.field,
      locale,
    });

    if (result.success) {
      const next = { ...stored };
      delete next[locale];
      setStored(next);
      setDrafts((prev) => ({ ...prev, [locale]: { body: '' } }));
      updateFieldCoverage(selected.key, new Map(Object.entries(next)));
      await reinstallActiveIndex();
      flash('ok', t('translationStudio.removed', 'Removed'));
    } else {
      console.error('Translation delete failed:', result.error);
      flash('error', t('translationStudio.saveError', 'Could not save'));
    }

    setBusy(false);
  };

  const toggleSource = (entityType) => {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(entityType)) next.delete(entityType);
      else next.add(entityType);
      return next;
    });
  };

  const toggleField = (entityType, fieldName) => {
    const key = fieldFilterKey(entityType, fieldName);
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resizeLeftPanelWithKeyboard = (event) => {
    let next = leftPanelWidthRef.current;
    if (event.key === 'ArrowLeft') next -= 20;
    else if (event.key === 'ArrowRight') next += 20;
    else if (event.key === 'Home') next = DEFAULT_LEFT_PANEL_WIDTH;
    else return;

    event.preventDefault();
    next = Math.min(MAX_LEFT_PANEL_WIDTH, Math.max(MIN_LEFT_PANEL_WIDTH, next));
    leftPanelWidthRef.current = next;
    setLeftPanelWidth(next);
    persistLeftPanelWidth(next);
  };

  const resetLeftPanelWidth = () => {
    leftPanelWidthRef.current = DEFAULT_LEFT_PANEL_WIDTH;
    setLeftPanelWidth(DEFAULT_LEFT_PANEL_WIDTH);
    persistLeftPanelWidth(DEFAULT_LEFT_PANEL_WIDTH);
  };

  // ---------------------------------------------------------------------------
  // Styling — "Industry" (src/theme/industry.js). Radius 0, hairline rules,
  // status through weight rather than red / amber / green.
  // ---------------------------------------------------------------------------
  const frameStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
    colorScheme: isDarkMode ? 'dark' : 'light',
    fontFamily: BODY,
    fontSize: 14,
    borderRadius: 0,
  };
  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const fieldLabelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 6,
  };
  const textareaStyle = {
    width: '100%', padding: '7px 10px', resize: 'vertical', scrollMarginBottom: '7rem',
    border: `1px solid ${ind.hairline}`, borderRadius: 0,
    background: 'transparent', color: ind.ink, fontFamily: BODY, fontSize: 13,
  };
  const iconBtnStyle = {
    width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${ind.hairline}`, background: 'transparent', color: ind.ink,
    borderRadius: 0, cursor: 'pointer', padding: 0, flex: 'none',
  };
  const chipStyle = (active) => ({
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.08em',
    textTransform: 'uppercase', padding: '3px 8px', borderRadius: 0, cursor: 'pointer',
    whiteSpace: 'nowrap',
    background: active ? ind.accent : 'transparent',
    color: active ? ind.accentInk : ind.inkMuted,
    border: `1px solid ${active ? ind.accent : ind.hairline}`,
    transition: 'background .15s ease, color .15s ease',
  });

  const hasQueue = !loading && !loadError && canEdit && !demo;
  const hasCoverage = hasQueue && storeReady;
  const pendingCount = hasCoverage ? queue.missingCount : '—';
  useEffect(() => {
    if (hasCoverage) publishTranslationQueueCount(user?.id, pendingCount);
  }, [hasCoverage, user?.id, pendingCount]);

  const totalFields = queue.fields.size;
  const coveragePercent = totalFields ? Math.round(100 * (totalFields - queue.missingCount) / totalFields) : null;
  const advancedCount = Number(sources.size !== ENTITY_TYPES.length)
    + Number(selectedFields.size !== FIELD_FILTER_KEYS.length) + Number(Boolean(language));
  const activeFilters = advancedCount > 0 || status !== 'missing' || Boolean(query);
  const filteredSearch = Boolean(query.trim()) && searchMatches.length > visible.length;
  const editorLocales = missingOnly ? locales.filter((locale) => !stored[locale]) : locales;
  const statusFilters = [
    ['missing', t('translationStudio.filter_missing', 'Missing')],
    ['partial', t('translationStudio.filter_partial', 'Partial')],
    ['complete', t('translationStudio.filter_translated', 'Complete')],
    ['all', t('translationStudio.filter_all', 'All')],
    ...(queue.outdatedCount || status === 'outdated' ? [['outdated', t('translationStudio.filter_stale', 'Out of date')]] : []),
  ];

  const ticker = (
    <div
      style={{
        height: 44, background: ind.tickerBg, color: ind.tickerInk,
        borderBottom: `1px solid ${ind.hairline}`,
        display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
      }}
    >
      <TickerCell ind={ind}>
        <LiveClock ind={ind} live={hasQueue && totalFields > 0} />
      </TickerCell>
      <TickerCell ind={ind} label={t('translationStudio.strings', 'Strings')} value={hasQueue ? totalFields : '—'} />
      <TickerCell ind={ind} label={t('translationStudio.inQueue', 'In queue')} value={hasQueue ? visible.length : '—'} />
      <TickerCell
        ind={ind}
        label={t('translationStudio.pending', 'To translate')}
        value={pendingCount}
        title={t('translationStudio.pendingHint', 'Fields still missing translations')}
      />
      <TickerCell ind={ind} label={t('translationStudio.locales', 'Locales')} value={locales.length} />
      <TickerCell
        ind={ind}
        label={t('translationStudio.coverage', 'Coverage')}
        value={hasCoverage && coveragePercent != null ? `${coveragePercent}%` : '—'}
        valueColor={hasCoverage && coveragePercent != null && coveragePercent < 100 ? ind.tickerUp : undefined}
      />
      <TickerCell
        ind={ind}
        label={t('translationStudio.selected', 'Selected')}
        value={hasCoverage && selected ? `${selected.translatedCount}/${selected.localeCount}` : '—'}
      />

      <div
        style={{
          flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', gap: 8, padding: '0 14px',
          borderLeft: `1px solid ${ind.tickerRule}`,
        }}
      >
        <FetchElapsedPill active={loading || busy || suggestingAll} isDarkMode label={t('common.fetching', 'Fetching')} />
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {(currentLanguage || '').toUpperCase()}
        </span>
      </div>
    </div>
  );

  // Mirrors the access-denied panel in userManagement.jsx. This only removes
  // the UI — the RLS policies behind hr_can_translate() are what actually
  // refuse a write.
  if (!canEdit) {
    return (
      <div data-screen-label="Translation Studio" style={frameStyle}>
        {ticker}
        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ border: `1px solid ${ind.ink}`, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 460 }}>
            <AlertTriangle size={16} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
            <div style={{ minWidth: 0 }}>
              <Kicker ind={ind} color={ind.ink}>{t('common.error', 'Error')}</Kicker>
              <p style={{ ...caption, marginTop: 4 }}>
                {t('translationStudio.accessDenied', 'Access Denied: Admin privileges required')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (demo) {
    return (
      <div data-screen-label="Translation Studio" style={frameStyle}>
        {ticker}
        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
          <Blueprint ind={ind} style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 460 }}>
            <Languages size={26} strokeWidth={1.25} style={{ color: ind.inkFaint, margin: '0 auto' }} />
            <div style={{ marginTop: 12 }}>
              <ColumnHeading ind={ind}>{t('translationStudio.title', 'Translation Studio')}</ColumnHeading>
            </div>
            <p style={{ ...caption, marginTop: 6 }}>
              {t(
                'translationStudio.demoUnavailable',
                'Translations are stored on the server and are unavailable in demo mode.'
              )}
            </p>
          </Blueprint>
        </div>
      </div>
    );
  }

  /** A configuration warning: ink border, never amber. */
  const notice = (message) => (
    <div style={{ border: `1px solid ${ind.ink}`, padding: '11px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <AlertTriangle size={15} strokeWidth={1.5} style={{ flex: 'none', marginTop: 2, color: ind.ink }} />
      <p style={{ ...caption, fontSize: 12.5 }}>{message}</p>
    </div>
  );

  return (
    <div data-screen-label="Translation Studio" style={frameStyle}>
      {ticker}

      {/* ── ONE BAND — the queue is the index, the editor is the panel ─── */}
      <div className="p-3 sm:p-5" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── PAGE HEAD ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
              {t('translationStudio.title', 'Translation Studio')}
            </h1>
            <p style={{ ...caption, marginTop: 6 }}>
              {t(
                'translationStudio.subtitle',
                'Hand-written translations for tasks, goals, reviews and leave requests. These override the automatic ones everywhere.'
              )}
            </p>
          </div>

          <Btn
            ind={ind}
            onClick={loadQueue}
            disabled={loading || editorWorking}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}
          >
            <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'animate-spin' : undefined} />
            {t('common.refresh', 'Refresh')}
          </Btn>
        </div>

        {!storeReady && notice(t(
          'translationStudio.notConfigured',
          'The translations table is missing. Apply migration 018_hr_ugc_translations.sql (supabase db push) to enable saving.'
        ))}

        {!isLocalTranslationSupported() && notice(t(
          'translationStudio.noLocalModel',
          'This browser has no on-device translator, so machine drafts are unavailable. You can still write translations by hand.'
        ))}

        <div
          className="grid grid-cols-1 lg:grid-cols-[var(--translation-studio-sidebar)_minmax(0,1fr)]"
          style={{ '--translation-studio-sidebar': `${leftPanelWidth}px`, gap: 16 }}
        >
          {/* ---- Queue: the index this screen navigates by ---------------- */}
          <aside
            ref={leftPanelRef}
            className="relative h-fit lg:sticky lg:top-4"
            style={{ minWidth: 0, border: `1px solid ${ind.hairline}`, background: ind.chrome }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuemin={MIN_LEFT_PANEL_WIDTH}
              aria-valuemax={MAX_LEFT_PANEL_WIDTH}
              aria-valuenow={Math.round(leftPanelWidth)}
              aria-label={t('translationStudio.resizePanel', 'Resize source panel')}
              tabIndex={0}
              onPointerDown={(event) => {
                event.preventDefault();
                setIsResizingLeftPanel(true);
              }}
              onDoubleClick={resetLeftPanelWidth}
              onKeyDown={resizeLeftPanelWithKeyboard}
              className="hidden lg:block absolute -right-2 top-3 bottom-3 z-10 w-4 cursor-col-resize outline-none"
              style={{ background: 'transparent' }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: '50%', top: 0, height: '100%', width: 1,
                  transform: 'translateX(-50%)',
                  background: isResizingLeftPanel ? ind.accent : ind.hairline,
                  transition: 'background .15s ease',
                }}
              />
            </div>

            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${ind.hairline}` }}>
              <div className="flex items-center" style={{ gap: 8, padding: '5px 10px', border: `1px solid ${ind.hairline}` }}>
                <Search size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                <input
                  type="search"
                  value={query}
                  disabled={busy}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('translationStudio.searchPlaceholder', 'Search text, record or employee')}
                  aria-label={t('translationStudio.searchPlaceholder', 'Search text, record or employee')}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                    color: ind.ink, fontFamily: BODY, fontSize: 12.5, padding: 0,
                  }}
                />
              </div>
              <div
                className="flex flex-wrap"
                role="group"
                aria-label={t('translationStudio.status', 'Status')}
                style={{ gap: 5, marginTop: 9 }}
              >
                {statusFilters.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    title={value === 'missing' ? t('translationStudio.pendingHint', 'Fields still missing translations') : undefined}
                    disabled={busy}
                    onClick={() => setStatus(value)}
                    style={chipStyle(status === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <details style={{ marginTop: 9 }}>
                <summary style={{ ...caption, color: ind.ink, cursor: 'pointer' }}>
                  {t('translationStudio.advancedFilters', 'Advanced filters')}
                  {advancedCount > 0 && ` (${advancedCount})`}
                </summary>
                <div className="flex flex-col" style={{ gap: 12, paddingTop: 10 }}>
                  <label>
                    <span style={fieldLabelStyle}>{t('translationStudio.languageFilter', 'Language')}</span>
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      disabled={busy}
                      style={{ ...textareaStyle, resize: 'none', background: ind.chrome }}
                    >
                      <option value="">{t('translationStudio.allLanguages', 'All languages')}</option>
                      {locales.map((locale) => <option key={locale} value={locale}>{SUPPORTED_LANGUAGES[locale].name}</option>)}
                    </select>
                  </label>
                  <div>
                    <span style={fieldLabelStyle}>{t('translationStudio.sources', 'Sources')}</span>
                    <div className="flex flex-wrap" style={{ gap: 5 }}>
                      {ENTITY_TYPES.filter((type) => queue.sources.has(type)).map((type) => (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={sources.has(type)}
                          disabled={busy}
                          onClick={() => toggleSource(type)}
                          style={chipStyle(sources.has(type))}
                        >
                          {t(TRANSLATABLE_ENTITIES[type].labelKey, type)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {ENTITY_TYPES.some((type) => sources.has(type) && queue.sources.has(type)) && (
                    <div>
                      <span style={fieldLabelStyle}>{t('translationStudio.fields', 'Fields')}</span>
                      <div className="flex flex-col" style={{ gap: 8 }}>
                        {ENTITY_TYPES.filter((type) => sources.has(type) && queue.sources.has(type)).map((type) => (
                          <div key={type}>
                            <span style={caption}>{t(TRANSLATABLE_ENTITIES[type].labelKey, type)}</span>
                            <div className="flex flex-wrap" style={{ gap: 5, marginTop: 3 }}>
                              {TRANSLATABLE_ENTITIES[type].fields.map((field) => {
                                const key = fieldFilterKey(type, field);
                                const count = queue.fieldCounts.get(key);
                                if (!count) return null;
                                const active = selectedFields.has(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    aria-pressed={active}
                                    disabled={busy}
                                    onClick={() => toggleField(type, field)}
                                    style={chipStyle(active)}
                                  >
                                    {t(`translationStudio.field_${field}`, field.replace(/_/g, ' '))} ({count})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Btn ind={ind} onClick={resetFilters} disabled={busy || !activeFilters} style={{ alignSelf: 'flex-start' }}>
                    {t('translationStudio.resetAll', 'Reset all')}
                  </Btn>
                </div>
              </details>
            </div>

            <div
              id="translation-studio-queue"
              ref={queueListRef}
              role="region"
              aria-label={t('translationStudio.inQueue', 'In queue')}
              tabIndex={-1}
              style={{ maxHeight: '52vh', overflowY: 'auto' }}
            >
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: ind.inkMuted }} />
                </div>
              )}

              {!loading && loadError && (
                <p style={{ ...caption, fontSize: 12.5, padding: '16px 14px' }}>
                  {t('translationStudio.loadError', 'Could not load translatable content.')}
                </p>
              )}

              {!loading && !loadError && visible.length === 0 && (
                <p role="status" style={{ ...caption, fontSize: 12.5, padding: '16px 14px' }}>
                  {status === 'missing' && !query.trim()
                    ? t('translationStudio.noMissing', 'No missing translations match these filters.')
                    : t('translationStudio.empty', 'Nothing matches these filters.')}
                </p>
              )}

              {!loading && !loadError && filteredSearch && (
                <Btn
                  ind={ind}
                  onClick={() => { clearAdvancedFilters(); setStatus('all'); }}
                  disabled={busy}
                  style={{ margin: '8px 14px', maxWidth: 'calc(100% - 28px)' }}
                >
                  {t('translationStudio.showAllSearchMatches', 'Show all {count} matching fields').replace('{count}', searchMatches.length)}
                </Btn>
              )}

              {!loading && !loadError && visible.map((entry, index) => {
                const active = entry.key === selection?.key;
                const { translatedCount, localeCount, missingLocales, outdatedLocales } = entry;
                const variant = missingLocales.length === 0 ? 'accent' : translatedCount ? 'outline' : 'neutral';
                const languageGroups = [
                  [missingLocales, t('translationStudio.filter_missing', 'Missing')],
                  [outdatedLocales, t('translationStudio.filter_stale', 'Out of date')],
                ];

                return (
                  <div
                    key={entry.key}
                    style={{
                      padding: '8px 14px 9px 11px',
                      borderTop: index === 0 ? 'none' : `1px solid ${ind.rule}`,
                      borderLeft: `3px solid ${active ? ind.accent : 'transparent'}`,
                      background: active ? ind.accentWash : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      aria-current={active || undefined}
                      disabled={editorWorking}
                      onClick={() => selectEntry(entry, language)}
                      className="block w-full text-left"
                      style={{ border: 0, background: 'transparent', padding: '2px 0', cursor: 'pointer' }}
                    >
                      <span className="flex items-center justify-between" style={{ gap: 8, marginBottom: 3 }}>
                        <span className="truncate" style={{ ...fieldLabelStyle, minWidth: 0, marginBottom: 0 }}>
                          {`${t(TRANSLATABLE_ENTITIES[entry.entityType].labelKey, entry.entityType)} · ${t(`translationStudio.field_${entry.field}`, entry.field.replace(/_/g, ' '))}`}
                        </span>
                        {hasCoverage && (
                          <span title={t('translationStudio.fieldCoverageHint', 'Translated languages / supported languages')}>
                            <Tag ind={ind} variant={variant}>{`${translatedCount}/${localeCount}`}</Tag>
                          </span>
                        )}
                      </span>
                      {entry.recordLabel !== entry.sourceText && (
                        <span className="block truncate" title={entry.recordLabel} style={{ ...caption, color: ind.ink, fontWeight: 600 }}>
                          {entry.recordLabel}
                        </span>
                      )}
                      <span className="line-clamp-3 break-words" style={{ ...caption, color: ind.ink, lineHeight: 1.45 }}>
                        {entry.sourceText}
                      </span>
                      {entry.employeeName && (
                        <span className="block truncate" style={{ ...caption, fontSize: 11.5, marginTop: 2 }}>
                          {entry.employeeName}
                        </span>
                      )}
                    </button>
                    {hasCoverage && languageGroups.map(([codes, label]) => codes.length > 0 && (
                      <div key={label} role="group" aria-label={label} className="flex flex-wrap items-center" style={{ gap: 4, marginTop: 4 }}>
                        <span style={{ ...fieldLabelStyle, margin: '0 3px 0 0' }}>{label}</span>
                        {codes.map((locale) => (
                          <button
                            key={locale}
                            type="button"
                            aria-label={`${SUPPORTED_LANGUAGES[locale].name} · ${label}`}
                            title={SUPPORTED_LANGUAGES[locale].name}
                            disabled={editorWorking}
                            onClick={() => selectEntry(entry, locale)}
                            style={{ ...chipStyle(language === locale), padding: '2px 5px', minHeight: 23 }}
                          >
                            {locale.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {hasCoverage && queue.sources.size > 0 && (
              <div style={{ padding: '10px 14px 12px', borderTop: `1px solid ${ind.hairline}` }}>
                <span style={fieldLabelStyle}>{t('translationStudio.sourceCoverage', 'Source coverage')}</span>
                <div className="grid grid-cols-2" style={{ gap: 6 }}>
                  {ENTITY_TYPES.filter((type) => queue.sources.has(type)).map((type) => {
                    const { records, completeRecords, missingFields, outdatedFields } = queue.sources.get(type);
                    const nextStatus = missingFields || !outdatedFields ? 'missing' : 'outdated';
                    const active = sources.size === 1 && sources.has(type) && status === nextStatus;
                    return (
                      <Btn
                        key={type}
                        ind={ind}
                        aria-controls="translation-studio-queue"
                        aria-pressed={active}
                        disabled={busy}
                        onClick={() => openSourceQueue(type, nextStatus)}
                        style={{
                          minWidth: 0, textAlign: 'left', padding: '5px 7px', textTransform: 'none', letterSpacing: 0,
                          background: active ? ind.accentWash : 'transparent', borderColor: active ? ind.accent : ind.hairline,
                        }}
                      >
                        <span className="block break-words" style={{ fontFamily: BODY, fontSize: 12 }}>
                          {t(TRANSLATABLE_ENTITIES[type].labelKey, type)}
                        </span>
                        <span className="block" style={{ ...caption, fontSize: 11, marginBottom: 3 }}>
                          {t('translationStudio.completeRecords', '{done} of {total} records complete').replace('{done}', completeRecords).replace('{total}', records)}
                        </span>
                        <span aria-hidden="true" className="block" style={{ height: 4, border: `1px solid ${ind.hairline}` }}>
                          <span className="block h-full" style={{ background: ind.accent, width: `${100 * completeRecords / records}%` }} />
                        </span>
                        <span className="block" style={{ ...caption, fontSize: 11, marginTop: 3 }}>
                          {nextStatus === 'outdated'
                            ? t('translationStudio.outdatedFields', 'Outdated fields ({count})').replace('{count}', outdatedFields)
                            : t('translationStudio.missingFields', 'Fields to translate ({count})').replace('{count}', missingFields)}
                        </span>
                      </Btn>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* ---- Editor --------------------------------------------------- */}
          <Blueprint ind={ind} style={{ padding: '18px 20px 16px', minWidth: 0 }}>
            {!selected && (
              <p style={{ ...caption, padding: '48px 0', textAlign: 'center' }}>
                {t('translationStudio.chooseTranslation', 'Choose a language in the queue to start translating.')}
              </p>
            )}

            {selected && (
              <>
                <header style={{ marginBottom: 16 }}>
                  <Kicker ind={ind}>
                    {`${t(TRANSLATABLE_ENTITIES[selected.entityType].labelKey, selected.entityType)} · ${selected.recordLabel} · ${t(`translationStudio.field_${selected.field}`, selected.field.replace(/_/g, ' '))}`}
                  </Kicker>

                  {/* The source. The one tinted box on this screen. */}
                  <div
                    style={{
                      marginTop: 8, padding: '10px 12px', whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      border: `1px solid ${ind.hairline}`, background: ind.accentWash,
                      fontFamily: BODY, fontSize: 13.5, color: ind.ink, lineHeight: 1.5,
                    }}
                  >
                    {selected.sourceText}
                  </div>

                  <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 12 }}>
                    <Btn
                      ind={ind}
                      onClick={suggestAll}
                      disabled={editorState !== 'ready' || editorWorking || !isLocalTranslationSupported()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {suggestingAll
                        ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                        : <Wand2 size={13} strokeWidth={1.5} />}
                      {t('translationStudio.suggestAll', 'Suggest all empty')}
                    </Btn>

                    <Btn
                      ind={ind}
                      onClick={translateAll}
                      disabled={editorState !== 'ready' || editorWorking || !isLocalTranslationSupported()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Languages size={13} strokeWidth={1.5} />
                      {t('translationStudio.translateAll', 'Translate all')}
                    </Btn>

                    <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, minWidth: 0 }}>
                      {t('translationStudio.suggestHint', 'Fills blank boxes only. Nothing is saved until you review it.')}
                    </span>

                    {downloadProgress != null && (
                      <span
                        className="inline-flex items-center"
                        style={{
                          gap: 6, fontFamily: DISPLAY, fontWeight: 600, fontSize: 11,
                          letterSpacing: '.08em', textTransform: 'uppercase', color: ind.accentDeep,
                        }}
                      >
                        <Download size={12} strokeWidth={1.5} />
                        {`${t('translationStudio.downloading', 'Downloading language model')} ${Math.round(downloadProgress * 100)}%`}
                      </span>
                    )}
                  </div>
                </header>

                {editorState === 'loading' && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: ind.inkMuted }} />
                  </div>
                )}

                {editorState === 'error' && (
                  <p style={{ ...caption, padding: '24px 0' }}>
                    {t('translationStudio.loadError', 'Could not load translatable content.')}
                  </p>
                )}

                {editorState === 'ready' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label className="flex items-center self-start" style={{ ...caption, color: ind.ink, gap: 7 }}>
                      <input
                        type="checkbox"
                        checked={missingOnly}
                        onChange={(event) => setMissingOnly(event.target.checked)}
                        style={{ accentColor: ind.accent }}
                      />
                      {t('translationStudio.missingLanguagesOnly', 'Show missing languages only')}
                    </label>
                    {editorLocales.length === 0 && (
                      <p role="status" style={caption}>
                        {t('translationStudio.noMissingLanguages', 'This field has a saved translation in every language.')}
                      </p>
                    )}
                    {editorLocales.map((locale) => {
                        const lang = SUPPORTED_LANGUAGES[locale];
                        const value = drafts[locale]?.body || '';
                        const savedEntry = stored[locale];
                        const stale = savedEntry && isOutdatedTranslation(selected, savedEntry.sourceText);

                        return (
                          <div key={locale}>
                            <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 5 }}>
                              <label
                                htmlFor={`tr-${locale}`}
                                className="flex items-center"
                                style={{
                                  gap: 8, minWidth: 0,
                                  fontFamily: DISPLAY, fontWeight: 600, fontSize: 12,
                                  letterSpacing: '.08em', textTransform: 'uppercase', color: ind.ink,
                                }}
                              >
                                {lang?.flag && (
                                  <img
                                    src={lang.flag}
                                    alt=""
                                    style={{ width: 18, height: 12, objectFit: 'cover', flex: 'none', border: `1px solid ${ind.hairline}` }}
                                  />
                                )}
                                {lang?.name || locale}
                                {savedEntry && !stale && (
                                  <Check size={13} strokeWidth={1.5} style={{ color: ind.accentDeep, flex: 'none' }} aria-hidden />
                                )}
                                {stale && (
                                  <span title={savedEntry.sourceText}>
                                    <Tag ind={ind} variant="outline">{t('translationStudio.stale', 'source changed')}</Tag>
                                  </span>
                                )}
                              </label>

                              <div className="flex items-center" style={{ gap: 5, flex: 'none' }}>
                                {availability[locale] === 'downloadable' && (
                                  <span
                                    title={t('translationStudio.needsDownload', 'Suggesting this language downloads a model first')}
                                    style={{ color: ind.inkFaint, display: 'inline-flex' }}
                                  >
                                    <Download size={12} strokeWidth={1.5} />
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => machineDraft(locale)}
                                  disabled={
                                    editorWorking
                                    || !isLocalTranslationSupported()
                                    || availability[locale] === 'unavailable'
                                  }
                                  title={t('translationStudio.machineDraft', 'Machine draft')}
                                  aria-label={t('translationStudio.machineDraft', 'Machine draft')}
                                  style={{
                                    ...iconBtnStyle,
                                    opacity: (editorWorking || !isLocalTranslationSupported() || availability[locale] === 'unavailable') ? 0.4 : 1,
                                  }}
                                >
                                  {drafting === locale
                                    ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                                    : <Wand2 size={12} strokeWidth={1.5} />}
                                </button>
                                {savedEntry && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(locale)}
                                    disabled={!canWrite}
                                    title={t('translationStudio.remove', 'Remove')}
                                    aria-label={t('translationStudio.remove', 'Remove')}
                                    style={{ ...iconBtnStyle, opacity: canWrite ? 1 : 0.4 }}
                                  >
                                    <Trash2 size={12} strokeWidth={1.5} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <textarea
                              id={`tr-${locale}`}
                              ref={(field) => {
                                if (field) editorFields.current.set(locale, field);
                                else editorFields.current.delete(locale);
                              }}
                              rows={Math.min(6, Math.max(2, Math.ceil(selected.sourceText.length / 70)))}
                              value={value}
                              onChange={(e) => updateDraft(locale, e.target.value)}
                              readOnly={busy}
                              placeholder={selected.sourceText}
                              style={textareaStyle}
                            />
                          </div>
                        );
                      })}

                    <div
                      className="flex flex-wrap items-center"
                      style={{
                        position: 'sticky', bottom: 0, zIndex: 1, background: ind.ground,
                        gap: 8, padding: '8px 0', borderTop: `1px solid ${ind.rule}`,
                      }}
                    >
                      {/* The single solid object on this screen — kept as a
                          ShinyButton so the commit still catches the light. */}
                      <ShinyButton
                        type="button"
                        onClick={() => handleSave()}
                        disabled={!canSave}
                        shineOnHover
                        className="rounded-none border px-3 py-1"
                        style={{
                          borderRadius: 0,
                          background: dirtyLocales.length ? ind.accent : 'transparent',
                          color: dirtyLocales.length ? ind.accentInk : ind.inkMuted,
                          borderColor: dirtyLocales.length ? ind.accent : ind.hairline,
                          opacity: busy ? 0.5 : 1,
                          cursor: canSave ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {busy
                          ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                          : <Save size={13} strokeWidth={1.5} />}
                        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          {dirtyLocales.length
                            ? `${t('common.save', 'Save')} (${dirtyLocales.length})`
                            : t('common.save', 'Save')}
                        </span>
                      </ShinyButton>

                      <Btn ind={ind} onClick={() => handleSave(true)} disabled={!canSave}>
                        {t('translationStudio.saveNextMissing', 'Save & Next Missing')}
                      </Btn>

                      {feedback && (
                        <span
                          role="status"
                          className="inline-flex items-center"
                          style={{
                            gap: 6, fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5,
                            letterSpacing: '.08em', textTransform: 'uppercase',
                            // Success is accent; anything else is full ink. No red.
                            color: feedback.kind === 'ok' ? ind.accentDeep : ind.ink,
                          }}
                        >
                          {feedback.kind === 'ok'
                            ? <Check size={13} strokeWidth={1.5} />
                            : <AlertTriangle size={13} strokeWidth={1.5} />}
                          {feedback.message}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Blueprint>
        </div>
      </div>
    </div>
  );
};

export default TranslationStudio;
