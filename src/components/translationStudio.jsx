import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Languages,
  Loader,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../utils/demoHelper';
import { cn } from '@/lib/utils';
import { ShinyButton } from './ui/shiny-button';
import { PageLiveClock } from './ui/page-live-clock';
import {
  ENTITY_TYPES,
  TRANSLATABLE_ENTITIES,
  buildTranslationIndex,
  deleteTranslation,
  fetchLocaleTranslations,
  fetchRecordTranslations,
  fetchTranslationCoverage,
  fetchTranslatableRecords,
  normalizeSource,
  saveTranslationBatch,
} from '../services/ugcTranslationService';
import {
  isLocalTranslationSupported,
  prepareTranslation,
  setManualTranslations,
  translateText,
  translationAvailability,
} from '../services/translateService';
import { isTranslationStoreAvailable } from '../services/ugcTranslationService';
import { isTranslationEditor } from '../utils/translationAccess';

/**
 * Translation Studio — the full-page editor for hand-authored translations of
 * user-generated content.
 *
 * It is deliberately not a modal. The work is comparative (source text on one
 * side, nine target languages on the other) and long-running: an editor works
 * through a queue of dozens of strings in a sitting, and a dialog that traps
 * focus and hides the app behind a scrim is the wrong container for that.
 *
 * The queue is assembled from the same four tables the rest of the app writes
 * to — tasks, personal goals, performance reviews, leave requests — so nothing
 * has to be re-entered here. Saved translations land in hr_ugc_translations and
 * outrank the on-device machine translation everywhere UGC is rendered.
 */

/** Rows whose translation predates the current source text. */
const isStale = (entry, storedSource) =>
  Boolean(storedSource) && normalizeSource(storedSource) !== entry.sourceText;

const LEFT_PANEL_WIDTH_KEY = 'translation-studio-left-panel-width';
const DEFAULT_LEFT_PANEL_WIDTH = 320;
const MIN_LEFT_PANEL_WIDTH = 260;
const MAX_LEFT_PANEL_WIDTH = 560;

const fieldFilterKey = (entityType, field) => `${entityType}:${field}`;

const allFieldFilters = () => new Set(
  ENTITY_TYPES.flatMap((entityType) =>
    TRANSLATABLE_ENTITIES[entityType].fields.map((field) => fieldFilterKey(entityType, field))
  )
);

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
  const { isDarkMode, bg, text, border } = useTheme();
  const { user } = useAuth();

  const demo = isDemoMode();
  const canEdit = isTranslationEditor(user);

  // ---- queue ----------------------------------------------------------------
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [storeReady, setStoreReady] = useState(true);

  // ---- filters --------------------------------------------------------------
  const [sources, setSources] = useState(() => new Set(ENTITY_TYPES));
  const [selectedFields, setSelectedFields] = useState(allFieldFilters);
  const [query, setQuery] = useState('');

  // ---- layout ---------------------------------------------------------------
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialLeftPanelWidth);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const leftPanelRef = useRef(null);
  const leftPanelWidthRef = useRef(leftPanelWidth);

  // ---- selection & editor ---------------------------------------------------
  const [selectedKey, setSelectedKey] = useState(null);
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

  // Coverage across the whole queue, keyed `entityType:entityId:field` →
  // Set(locale). Drives the per-row badges without a request per row.
  const [coverage, setCoverage] = useState(new Map());

  const feedbackTimer = useRef(null);

  const locales = useMemo(
    () => Object.values(SUPPORTED_LANGUAGES).map((l) => l.code),
    []
  );

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

    const map = new Map();

    (translations.data || []).forEach((row) => {
      if (!(row.body || '').trim()) return;
      const key = `${row.entity_type}:${row.entity_id}:${row.field}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(row.locale);
    });

    setEntries(records.data);
    setCoverage(map);
    // The queue reads the four source tables, which exist regardless; only the
    // translations table depends on migration 018. So the Studio can be fully
    // populated and still have nowhere to save to — say so explicitly rather
    // than letting the first Save fail.
    setStoreReady(isTranslationStoreAvailable());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Non-admins get the access-denied panel, so the queue — four table scans —
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
  /** Everything except the source checkboxes. */
  const matchesFilters = useCallback((entry) => {
    if (!selectedFields.has(fieldFilterKey(entry.entityType, entry.field))) return false;

    const needle = query.trim().toLowerCase();

    if (needle) {
      const haystack = `${entry.sourceText} ${entry.recordLabel} ${entry.employeeName}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  }, [query, selectedFields]);

  const visible = useMemo(
    () => entries.filter((entry) => sources.has(entry.entityType) && matchesFilters(entry)),
    [entries, sources, matchesFilters]
  );

  /**
   * Per-source record counts, and how many records are fully covered.
   *
   * The queue itself is one row per non-empty field, but the Sources section is
   * about HR records. Sets keep a task with four populated fields from being
   * reported as four tasks. A record is complete only when every populated
   * translatable field has all target locales. Source freshness is separate
   * metadata and must not make an otherwise complete record look untranslated.
   */
  const sourceCounts = useMemo(() => {
    const out = {};
    const entriesByRecord = new Map();
    const totalRecords = new Map();

    ENTITY_TYPES.forEach((entityType) => {
      out[entityType] = { done: 0, total: 0 };
      totalRecords.set(entityType, new Set());
    });

    entries.forEach((entry) => {
      if (!out[entry.entityType]) return;
      totalRecords.get(entry.entityType).add(entry.entityId);

      const key = `${entry.entityType}:${entry.entityId}`;
      if (!entriesByRecord.has(key)) entriesByRecord.set(key, []);
      entriesByRecord.get(key).push(entry);
    });

    ENTITY_TYPES.forEach((entityType) => {
      out[entityType].total = totalRecords.get(entityType).size;

      totalRecords.get(entityType).forEach((entityId) => {
        const recordEntries = entriesByRecord.get(`${entityType}:${entityId}`) || [];
        const complete = recordEntries.length > 0 && recordEntries.every((entry) => {
          const covered = coverage.get(entry.key);
          return covered && covered.size >= locales.length - 1;
        });
        if (complete) out[entityType].done += 1;
      });
    });

    return out;
  }, [entries, coverage, locales.length]);

  const selected = useMemo(
    () => visible.find((e) => e.key === selectedKey) || entries.find((e) => e.key === selectedKey) || null,
    [visible, entries, selectedKey]
  );

  // Keep a selection alive as filters change, so narrowing the queue does not
  // discard work in progress.
  useEffect(() => {
    if (!selectedKey && visible.length) setSelectedKey(visible[0].key);
  }, [visible, selectedKey]);

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selected) {
      setEditorState('idle');
      return undefined;
    }

    let cancelled = false;
    setEditorState('loading');
    setFeedback(null);

    fetchRecordTranslations(selected.entityType, selected.entityId)
      .then(({ success, data, error }) => {
        if (cancelled) return;
        if (!success) {
          setLoadError(error || '');
          setEditorState('error');
          return;
        }

        const next = {};
        (data || [])
          .filter((row) => row.field === selected.field)
          .forEach((row) => {
            next[row.locale] = {
              body: row.body || '',
              sourceText: row.source_text || '',
              provider: row.provider || 'manual',
            };
          });

        setStored(next);
        setDrafts(next);
        setEditorState('ready');
      })
      .catch(() => {
        if (!cancelled) setEditorState('error');
      });

    return () => { cancelled = true; };
    // Keyed on selectedKey, not `selected`: the latter is re-derived from the
    // filtered list, so depending on it would reload the editor — discarding
    // unsaved drafts — on every keystroke in the search box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

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
    setManualTranslations(currentLanguage, buildTranslationIndex(success ? data : []));
    refreshManualTranslations?.();
  }, [currentLanguage, refreshManualTranslations]);

  const handleSave = useCallback(async () => {
    if (!selected || !dirtyLocales.length) return;
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

      setCoverage((prev) => {
        const map = new Map(prev);
        const set = new Set(map.get(selected.key) || []);
        dirtyLocales.forEach((locale) => {
          if ((drafts[locale]?.body || '').trim()) set.add(locale);
          else set.delete(locale);
        });
        map.set(selected.key, set);
        return map;
      });

      // A saved translation must be live everywhere immediately, not on next
      // login: reinstall the index for whatever language the app is showing.
      await reinstallActiveIndex();
      flash('ok', t('translationStudio.saved', 'Saved'));
    } else {
      flash('error', result.error || t('translationStudio.saveError', 'Could not save'));
    }

    setBusy(false);
  }, [selected, dirtyLocales, drafts, stored, user, flash, t, reinstallActiveIndex]);

  const handleDelete = useCallback(async (locale) => {
    if (!selected) return;
    setBusy(true);

    const result = await deleteTranslation({
      entityType: selected.entityType,
      entityId: selected.entityId,
      field: selected.field,
      locale,
    });

    if (result.success) {
      setStored((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      });
      setDrafts((prev) => ({ ...prev, [locale]: { body: '' } }));
      setCoverage((prev) => {
        const map = new Map(prev);
        const set = new Set(map.get(selected.key) || []);
        set.delete(locale);
        map.set(selected.key, set);
        return map;
      });
      await reinstallActiveIndex();
      flash('ok', t('translationStudio.removed', 'Removed'));
    } else {
      flash('error', result.error || t('translationStudio.saveError', 'Could not save'));
    }

    setBusy(false);
  }, [selected, flash, t, reinstallActiveIndex]);

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
  // Styling helpers
  // ---------------------------------------------------------------------------
  const panel = cn('rounded-xl border', bg.secondary, border.primary);
  const field = cn(
    'w-full px-3 py-2 rounded-lg border text-sm',
    isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
  );

  // Mirrors the access-denied panel in userManagement.jsx. This only removes
  // the UI — the RLS policies behind hr_can_translate() are what actually
  // refuse a write.
  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">
              {t(
                'translationStudio.accessDenied',
                'Access Denied: Admin privileges required'
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (demo) {
    return (
      <div className="p-6">
        <div className={cn(panel, 'p-8 text-center')}>
          <Languages className={cn('w-10 h-10 mx-auto mb-3', text.secondary)} />
          <h2 className={cn('text-lg font-semibold mb-2', text.primary)}>
            {t('translationStudio.title', 'Translation Studio')}
          </h2>
          <p className={cn('text-sm', text.secondary)}>
            {t(
              'translationStudio.demoUnavailable',
              'Translations are stored on the server and are unavailable in demo mode.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={cn('text-2xl font-bold flex items-center gap-2', text.primary)}>
            <Languages className="w-6 h-6 text-blue-500" />
            {t('translationStudio.title', 'Translation Studio')}
          </h1>
          <p className={cn('text-sm mt-1', text.secondary)}>
            {t(
              'translationStudio.subtitle',
              'Hand-written translations for tasks, goals, reviews and leave requests. These override the automatic ones everywhere.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PageLiveClock />
          <ShinyButton
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className={cn('px-3 py-2 border flex items-center gap-2', text.secondary, border.primary)}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {t('common.refresh', 'Refresh')}
          </ShinyButton>
        </div>
      </div>

      {!storeReady && (
        <div className={cn(panel, 'px-4 py-3 text-sm flex items-start gap-2 border-amber-500/50', text.secondary)}>
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
          <span>
            {t(
              'translationStudio.notConfigured',
              'The translations table is missing. Apply migration 018_hr_ugc_translations.sql (supabase db push) to enable saving.'
            )}
          </span>
        </div>
      )}

      {!isLocalTranslationSupported() && (
        <div className={cn(panel, 'px-4 py-3 text-sm flex items-start gap-2', text.secondary)}>
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
          <span>
            {t(
              'translationStudio.noLocalModel',
              'This browser has no on-device translator, so machine drafts are unavailable. You can still write translations by hand.'
            )}
          </span>
        </div>
      )}

      <div
        className="grid grid-cols-1 lg:grid-cols-[var(--translation-studio-sidebar)_minmax(0,1fr)] gap-4"
        style={{ '--translation-studio-sidebar': `${leftPanelWidth}px` }}
      >
        {/* ---- Left rail: queue -------------------------------------------- */}
        <aside
          ref={leftPanelRef}
          className={cn(panel, 'relative p-4 space-y-4 h-fit lg:sticky lg:top-4')}
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
            className={cn(
              'hidden lg:block absolute -right-2 top-3 bottom-3 z-10 w-4 cursor-col-resize rounded-full outline-none',
              'after:absolute after:left-1/2 after:top-0 after:h-full after:w-1 after:-translate-x-1/2 after:rounded-full after:transition-colors',
              isResizingLeftPanel
                ? 'after:bg-blue-500'
                : isDarkMode
                  ? 'after:bg-gray-700 hover:after:bg-blue-500 focus:after:bg-blue-500'
                  : 'after:bg-gray-300 hover:after:bg-blue-500 focus:after:bg-blue-500'
            )}
          />
          <div>
            <label className={cn('block text-xs font-semibold uppercase tracking-wide mb-2', text.secondary)}>
              {t('translationStudio.sources', 'Sources')}
            </label>
            <div className="space-y-1">
              {ENTITY_TYPES.map((entityType) => {
                const { done, total } = sourceCounts[entityType];
                return (
                  <label
                    key={entityType}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm',
                      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200',
                      text.primary
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={sources.has(entityType)}
                      onChange={() => toggleSource(entityType)}
                      className="rounded"
                    />
                    <span className="flex-1">
                      {t(TRANSLATABLE_ENTITIES[entityType].labelKey, entityType)}
                    </span>
                    <span
                      className={cn('text-xs tabular-nums', text.secondary)}
                      title={t(
                        'translationStudio.sourceCountHint',
                        'Fully translated records / total records'
                      )}
                    >
                      <span className="opacity-70">{`${done}/${total}`}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {sources.size > 0 && (
            <div>
              <label className={cn('block text-xs font-semibold uppercase tracking-wide mb-2', text.secondary)}>
                {t('translationStudio.fields', 'Fields')}
              </label>
              <div className="space-y-2.5">
                {ENTITY_TYPES.filter((entityType) => sources.has(entityType)).map((entityType) => (
                  <div key={entityType}>
                    {sources.size > 1 && (
                      <div className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', text.secondary)}>
                        {t(TRANSLATABLE_ENTITIES[entityType].labelKey, entityType)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {TRANSLATABLE_ENTITIES[entityType].fields.map((fieldName) => {
                        const active = selectedFields.has(fieldFilterKey(entityType, fieldName));
                        return (
                          <button
                            key={fieldName}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleField(entityType, fieldName)}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-xs border transition-colors',
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : cn(
                                    text.secondary,
                                    border.primary,
                                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                                  )
                            )}
                          >
                            {t(
                              `translationStudio.field_${fieldName}`,
                              fieldName.replace(/_/g, ' ')
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <Search className={cn('w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2', text.secondary)} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('translationStudio.searchPlaceholder', 'Search text, record or employee')}
              className={cn(field, 'pl-9')}
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-1">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            )}

            {!loading && loadError && (
              <p className="text-sm text-red-500 py-4">
                {t('translationStudio.loadError', 'Could not load translatable content.')}
              </p>
            )}

            {!loading && !loadError && visible.length === 0 && (
              <p className={cn('text-sm py-4', text.secondary)}>
                {t('translationStudio.empty', 'Nothing matches these filters.')}
              </p>
            )}

            {!loading && visible.map((entry) => {
              const covered = coverage.get(entry.key);
              const done = covered ? covered.size : 0;
              const active = entry.key === selectedKey;

              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setSelectedKey(entry.key)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                    active
                      ? 'border-blue-500 bg-blue-500/10'
                      : cn(border.primary, isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200')
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={cn('text-[10px] uppercase tracking-wide font-semibold', text.secondary)}>
                      {t(TRANSLATABLE_ENTITIES[entry.entityType].labelKey, entry.entityType)}
                      {' · '}
                      {t(`translationStudio.field_${entry.field}`, entry.field.replace(/_/g, ' '))}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                        done === 0
                          ? 'bg-gray-500/20 text-gray-400'
                          : done >= locales.length - 1
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-amber-500/20 text-amber-500'
                      )}
                    >
                      {done}/{locales.length - 1}
                    </span>
                  </div>
                  <p className={cn('text-sm line-clamp-2', text.primary)}>{entry.sourceText}</p>
                  {entry.employeeName && (
                    <p className={cn('text-xs mt-0.5 truncate', text.secondary)}>{entry.employeeName}</p>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ---- Right pane: editor ------------------------------------------ */}
        <section className={cn(panel, 'p-4 sm:p-6')}>
          {!selected && (
            <p className={cn('text-sm py-12 text-center', text.secondary)}>
              {t('translationStudio.selectPrompt', 'Pick a string on the left to translate it.')}
            </p>
          )}

          {selected && (
            <>
              <header className="mb-5">
                <div className={cn('text-xs uppercase tracking-wide font-semibold mb-1', text.secondary)}>
                  {t(TRANSLATABLE_ENTITIES[selected.entityType].labelKey, selected.entityType)}
                  {' · '}
                  {selected.recordLabel}
                  {' · '}
                  {t(`translationStudio.field_${selected.field}`, selected.field.replace(/_/g, ' '))}
                </div>
                <div
                  className={cn(
                    'p-3 rounded-lg border whitespace-pre-wrap text-sm',
                    isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200',
                    text.primary
                  )}
                >
                  {selected.sourceText}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <ShinyButton
                    type="button"
                    onClick={suggestAll}
                    disabled={suggestingAll || busy || !isLocalTranslationSupported()}
                    className={cn(
                      'px-3 py-1.5 border flex items-center gap-2 text-sm disabled:opacity-40',
                      text.secondary,
                      border.primary
                    )}
                  >
                    {suggestingAll ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {t('translationStudio.suggestAll', 'Suggest all empty')}
                  </ShinyButton>

                  <ShinyButton
                    type="button"
                    onClick={translateAll}
                    disabled={suggestingAll || busy || !isLocalTranslationSupported()}
                    className={cn(
                      'px-3 py-1.5 border flex items-center gap-2 text-sm disabled:opacity-40',
                      text.secondary,
                      border.primary
                    )}
                  >
                    <Languages className="w-4 h-4" />
                    {t('translationStudio.translateAll', 'Translate all')}
                  </ShinyButton>

                  <span className={cn('text-xs', text.secondary)}>
                    {t(
                      'translationStudio.suggestHint',
                      'Fills blank boxes only. Nothing is saved until you review it.'
                    )}
                  </span>

                  {downloadProgress != null && (
                    <span className={cn('text-xs flex items-center gap-2', text.secondary)}>
                      <Download className="w-3.5 h-3.5" />
                      {t('translationStudio.downloading', 'Downloading language model')}
                      {' '}
                      {Math.round(downloadProgress * 100)}%
                    </span>
                  )}
                </div>
              </header>

              {editorState === 'loading' && (
                <div className="flex justify-center py-10">
                  <Loader className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              )}

              {editorState === 'error' && (
                <p className="text-sm text-red-500 py-6">
                  {t('translationStudio.loadError', 'Could not load translatable content.')}
                </p>
              )}

              {editorState === 'ready' && (
                <div className="space-y-4">
                  {locales
                    // Show every locale. The interface language is not proof of
                    // the source language, and hiding it previously left that
                    // locale untranslated whenever an editor switched the UI.
                    .map((locale) => {
                      const lang = SUPPORTED_LANGUAGES[locale];
                      const value = drafts[locale]?.body || '';
                      const savedEntry = stored[locale];
                      const stale = savedEntry && isStale(selected, savedEntry.sourceText);

                      return (
                        <div key={locale}>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label
                              htmlFor={`tr-${locale}`}
                              className={cn('flex items-center gap-2 text-sm font-medium', text.primary)}
                            >
                              {lang?.flag && (
                                <img src={lang.flag} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                              )}
                              {lang?.name || locale}
                              {savedEntry && !stale && (
                                <Check className="w-3.5 h-3.5 text-green-500" aria-hidden />
                              )}
                              {stale && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500"
                                  title={savedEntry.sourceText}
                                >
                                  {t('translationStudio.stale', 'source changed')}
                                </span>
                              )}
                            </label>

                            <div className="flex items-center gap-1">
                              {availability[locale] === 'downloadable' && (
                                <span
                                  className={cn('text-[10px] flex items-center gap-1', text.secondary)}
                                  title={t(
                                    'translationStudio.needsDownload',
                                    'Suggesting this language downloads a model first'
                                  )}
                                >
                                  <Download className="w-3 h-3" />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => machineDraft(locale)}
                                disabled={
                                  drafting === locale
                                  || suggestingAll
                                  || !isLocalTranslationSupported()
                                  || availability[locale] === 'unavailable'
                                }
                                title={t('translationStudio.machineDraft', 'Machine draft')}
                                className={cn(
                                  'p-1.5 rounded-lg transition-colors disabled:opacity-40',
                                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200',
                                  text.secondary
                                )}
                              >
                                {drafting === locale ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Wand2 className="w-4 h-4" />
                                )}
                              </button>
                              {savedEntry && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(locale)}
                                  disabled={busy}
                                  title={t('translationStudio.remove', 'Remove')}
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors disabled:opacity-40 hover:text-red-500',
                                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200',
                                    text.secondary
                                  )}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <textarea
                            id={`tr-${locale}`}
                            rows={Math.min(6, Math.max(2, Math.ceil(selected.sourceText.length / 70)))}
                            value={value}
                            onChange={(e) => updateDraft(locale, e.target.value)}
                            placeholder={selected.sourceText}
                            className={field}
                          />
                        </div>
                      );
                    })}

                  <div className={cn('flex items-center gap-3 pt-2 border-t', border.primary)}>
                    <ShinyButton
                      type="button"
                      onClick={handleSave}
                      disabled={busy || dirtyLocales.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white border-blue-500 hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {dirtyLocales.length
                        ? `${t('common.save', 'Save')} (${dirtyLocales.length})`
                        : t('common.save', 'Save')}
                    </ShinyButton>

                    {feedback && (
                      <span
                        className={cn(
                          'text-sm flex items-center gap-1.5',
                          feedback.kind === 'ok' && 'text-green-500',
                          feedback.kind === 'warn' && 'text-amber-500',
                          feedback.kind === 'error' && 'text-red-500'
                        )}
                      >
                        {feedback.kind === 'ok' ? (
                          <Sparkles className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        {feedback.message}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default TranslationStudio;
