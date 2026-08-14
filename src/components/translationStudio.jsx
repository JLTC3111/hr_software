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
import { Blueprint, Bar, Tag, Btn, Kicker, ColumnHeading, TickerCell, LiveClock } from './ui/industry.jsx';
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
      console.error('Translation save failed:', result.error);
      flash('error', t('translationStudio.saveError', 'Could not save'));
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
      console.error('Translation delete failed:', result.error);
      flash('error', t('translationStudio.saveError', 'Could not save'));
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
  // Styling — "Industry" (src/theme/industry.js). Radius 0, hairline rules,
  // status through weight rather than red / amber / green.
  // ---------------------------------------------------------------------------
  const frameStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
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
    width: '100%', padding: '7px 10px', resize: 'vertical',
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
    color: active ? ind.accentInk : ind.inkGhost,
    border: `1px solid ${active ? ind.accent : ind.hairline}`,
    transition: 'background .15s ease, color .15s ease',
  });

  /** A locale is "target" when it is one of the ones an entry must carry. */
  const targetLocaleCount = Math.max(1, locales.length - 1);

  /** How much of the whole queue is finished — the ticker's one live figure. */
  const coveragePercent = useMemo(() => {
    if (entries.length === 0) return 0;
    const complete = entries.filter(
      (entry) => (coverage.get(entry.key)?.size || 0) >= targetLocaleCount
    ).length;
    return Math.round((complete / entries.length) * 100);
  }, [entries, coverage, targetLocaleCount]);

  const selectedCovered = selected ? (coverage.get(selected.key)?.size || 0) : 0;

  const ticker = (
    <div
      style={{
        height: 44, background: ind.tickerBg, color: ind.tickerInk,
        borderBottom: `1px solid ${ind.hairline}`,
        display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
      }}
    >
      <TickerCell ind={ind}>
        <LiveClock ind={ind} live={entries.length > 0} />
      </TickerCell>
      <TickerCell ind={ind} label={t('translationStudio.strings', 'Strings')} value={entries.length} />
      <TickerCell ind={ind} label={t('translationStudio.inQueue', 'In queue')} value={visible.length} />
      <TickerCell ind={ind} label={t('translationStudio.locales', 'Locales')} value={targetLocaleCount} />
      <TickerCell
        ind={ind}
        label={t('translationStudio.coverage', 'Coverage')}
        value={`${coveragePercent}%`}
        // The one figure on the strip that says how much work is left.
        valueColor={coveragePercent < 100 ? ind.tickerUp : undefined}
      />
      <TickerCell
        ind={ind}
        label={t('translationStudio.selected', 'Selected')}
        value={selected ? `${selectedCovered}/${targetLocaleCount}` : '—'}
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
      <div style={{ padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

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
            disabled={loading}
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
            style={{ border: `1px solid ${ind.hairline}`, background: ind.chrome }}
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

            {/* Sources — the count is a coverage bar, not a bare fraction. */}
            <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${ind.hairline}` }}>
              <span style={fieldLabelStyle}>{t('translationStudio.sources', 'Sources')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ENTITY_TYPES.map((entityType) => {
                  const { done, total } = sourceCounts[entityType];
                  const on = sources.has(entityType);
                  return (
                    <button
                      key={entityType}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSource(entityType)}
                      className="w-full text-left"
                      style={{
                        background: 'transparent', border: 'none', borderRadius: 0,
                        padding: 0, cursor: 'pointer', opacity: on ? 1 : 0.45,
                      }}
                    >
                      <span className="flex items-center" style={{ gap: 8 }}>
                        <span
                          style={{
                            width: 13, height: 13, flex: 'none', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${on ? ind.accent : ind.hairline}`,
                            background: on ? ind.accent : 'transparent',
                            color: ind.accentInk,
                          }}
                        >
                          {on && <Check size={9} strokeWidth={2.5} />}
                        </span>
                        <span
                          style={{
                            flex: 1, minWidth: 0, fontFamily: BODY, fontSize: 12.5, color: ind.ink,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {t(TRANSLATABLE_ENTITIES[entityType].labelKey, entityType)}
                        </span>
                        <span
                          title={t('translationStudio.sourceCountHint', 'Fully translated records / total records')}
                          style={{
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, color: ind.inkMuted,
                            fontVariantNumeric: 'tabular-nums', flex: 'none',
                          }}
                        >
                          {`${done}/${total}`}
                        </span>
                      </span>
                      <span className="block" style={{ marginTop: 5 }}>
                        <Bar ind={ind} value={total ? done / total : 0} height={5} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {sources.size > 0 && (
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${ind.hairline}` }}>
                <span style={fieldLabelStyle}>{t('translationStudio.fields', 'Fields')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ENTITY_TYPES.filter((entityType) => sources.has(entityType)).map((entityType) => (
                    <div key={entityType}>
                      {sources.size > 1 && (
                        <span
                          className="block"
                          style={{
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, letterSpacing: '.12em',
                            textTransform: 'uppercase', color: ind.inkFaint, marginBottom: 4,
                          }}
                        >
                          {t(TRANSLATABLE_ENTITIES[entityType].labelKey, entityType)}
                        </span>
                      )}
                      <div className="flex flex-wrap" style={{ gap: 5 }}>
                        {TRANSLATABLE_ENTITIES[entityType].fields.map((fieldName) => {
                          const active = selectedFields.has(fieldFilterKey(entityType, fieldName));
                          return (
                            <button
                              key={fieldName}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleField(entityType, fieldName)}
                              style={chipStyle(active)}
                            >
                              {t(`translationStudio.field_${fieldName}`, fieldName.replace(/_/g, ' '))}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${ind.hairline}` }}>
              <div className="flex items-center" style={{ gap: 8, padding: '5px 10px', border: `1px solid ${ind.hairline}` }}>
                <Search size={13} strokeWidth={1.5} style={{ flex: 'none', color: ind.inkFaint }} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('translationStudio.searchPlaceholder', 'Search text, record or employee')}
                  aria-label={t('translationStudio.searchPlaceholder', 'Search text, record or employee')}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                    color: ind.ink, fontFamily: BODY, fontSize: 12.5, padding: 0,
                  }}
                />
              </div>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
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
                <p style={{ ...caption, fontSize: 12.5, padding: '16px 14px' }}>
                  {t('translationStudio.empty', 'Nothing matches these filters.')}
                </p>
              )}

              {!loading && visible.map((entry, index) => {
                const covered = coverage.get(entry.key);
                const done = covered ? covered.size : 0;
                const active = entry.key === selectedKey;
                const variant = done === 0 ? 'neutral' : done >= targetLocaleCount ? 'accent' : 'outline';

                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setSelectedKey(entry.key)}
                    className="w-full text-left"
                    style={{
                      display: 'block', padding: '10px 14px 10px 11px', cursor: 'pointer',
                      border: 'none', borderRadius: 0,
                      borderTop: index === 0 ? 'none' : `1px solid ${ind.rule}`,
                      // The active row is an accent edge and a wash, never a filled card.
                      borderLeft: `3px solid ${active ? ind.accent : 'transparent'}`,
                      background: active ? ind.accentWash : 'transparent',
                      transition: 'background .15s ease',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = ind.hover; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span className="flex items-center justify-between" style={{ gap: 8, marginBottom: 3 }}>
                      <span
                        style={{
                          fontFamily: DISPLAY, fontWeight: 600, fontSize: 9.5, letterSpacing: '.12em',
                          textTransform: 'uppercase', color: ind.inkFaint, minWidth: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {`${t(TRANSLATABLE_ENTITIES[entry.entityType].labelKey, entry.entityType)} · ${t(`translationStudio.field_${entry.field}`, entry.field.replace(/_/g, ' '))}`}
                      </span>
                      <Tag ind={ind} variant={variant}>{`${done}/${targetLocaleCount}`}</Tag>
                    </span>
                    <span className="block line-clamp-2" style={{ fontFamily: BODY, fontSize: 13, color: ind.ink, lineHeight: 1.45 }}>
                      {entry.sourceText}
                    </span>
                    {entry.employeeName && (
                      <span className="block truncate" style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint, marginTop: 2 }}>
                        {entry.employeeName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ---- Editor --------------------------------------------------- */}
          <Blueprint ind={ind} style={{ padding: '18px 20px 16px', minWidth: 0 }}>
            {!selected && (
              <p style={{ ...caption, padding: '48px 0', textAlign: 'center' }}>
                {t('translationStudio.selectPrompt', 'Pick a string on the left to translate it.')}
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
                      disabled={suggestingAll || busy || !isLocalTranslationSupported()}
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
                      disabled={suggestingAll || busy || !isLocalTranslationSupported()}
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
                                    drafting === locale
                                    || suggestingAll
                                    || !isLocalTranslationSupported()
                                    || availability[locale] === 'unavailable'
                                  }
                                  title={t('translationStudio.machineDraft', 'Machine draft')}
                                  aria-label={t('translationStudio.machineDraft', 'Machine draft')}
                                  style={{
                                    ...iconBtnStyle,
                                    opacity: (drafting === locale || suggestingAll || !isLocalTranslationSupported() || availability[locale] === 'unavailable') ? 0.4 : 1,
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
                                    disabled={busy}
                                    title={t('translationStudio.remove', 'Remove')}
                                    aria-label={t('translationStudio.remove', 'Remove')}
                                    style={{ ...iconBtnStyle, opacity: busy ? 0.4 : 1 }}
                                  >
                                    <Trash2 size={12} strokeWidth={1.5} />
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
                              style={textareaStyle}
                            />
                          </div>
                        );
                      })}

                    <div
                      className="flex flex-wrap items-center"
                      style={{ gap: 12, paddingTop: 12, borderTop: `1px solid ${ind.rule}` }}
                    >
                      {/* The single solid object on this screen — kept as a
                          ShinyButton so the commit still catches the light. */}
                      <ShinyButton
                        type="button"
                        onClick={handleSave}
                        disabled={busy || dirtyLocales.length === 0}
                        shineOnHover
                        className="rounded-none border px-3 py-1"
                        style={{
                          borderRadius: 0,
                          background: dirtyLocales.length ? ind.accent : 'transparent',
                          color: dirtyLocales.length ? ind.accentInk : ind.inkMuted,
                          borderColor: dirtyLocales.length ? ind.accent : ind.hairline,
                          opacity: busy ? 0.5 : 1,
                          cursor: dirtyLocales.length && !busy ? 'pointer' : 'not-allowed',
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

                      {feedback && (
                        <span
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
