import { supabase } from '../config/supabaseClient';
import { isDemoMode } from '../utils/demoHelper';

/**
 * Hand-authored translations of user-generated content, persisted in
 * public.hr_ugc_translations (migration 018).
 *
 * This is the durable half of the translation stack. The other half —
 * translateService.js — runs Chromium's on-device Translator and is per-reader,
 * per-session and never persisted. Anything a human writes here outranks it
 * everywhere, forever.
 *
 * Lookup is indexed two ways off one table:
 *   1. by record   (entity_type, entity_id, field) — "this task's title in vi"
 *   2. by text     (source_text)                   — "any 'Fix login bug' in vi"
 * (2) is what makes the Studio's work compound: translating a phrase once fixes
 * it on every record that happens to use the same wording.
 */

/** Source tables the Studio reads, and the free-text columns worth translating. */
export const TRANSLATABLE_ENTITIES = {
  task: {
    table: 'workload_tasks',
    labelKey: 'translationStudio.sourceTasks',
    titleField: 'title',
    fields: ['title', 'description', 'self_assessment', 'comments'],
  },
  goal: {
    table: 'performance_goals',
    labelKey: 'translationStudio.sourceGoals',
    titleField: 'title',
    fields: ['title', 'description', 'notes', 'success_criteria'],
  },
  review: {
    table: 'performance_reviews',
    labelKey: 'translationStudio.sourceReviews',
    titleField: 'review_period',
    fields: ['strengths', 'areas_for_improvement', 'achievements', 'comments', 'employee_comments'],
  },
  leave: {
    table: 'leave_requests',
    labelKey: 'translationStudio.sourceLeave',
    titleField: 'leave_type',
    fields: ['reason', 'rejection_reason'],
  },
};

export const ENTITY_TYPES = Object.keys(TRANSLATABLE_ENTITIES);

/** Whitespace-insensitive so a trailing newline never forks a translation. */
export const normalizeSource = (text) => (text == null ? '' : String(text)).trim();

/** Stable key for the per-record index. */
export const recordKey = (entityType, entityId, field) =>
  `${entityType}:${entityId}:${field}`;

const ok = (data) => ({ success: true, data });

/**
 * Latches once Postgres reports the table is absent (42P01 undefined_table),
 * i.e. migration 018 has not been applied to this project yet.
 *
 * Manual translations are a progressive enhancement: without them every string
 * still renders, machine-translated or as written. So a missing table is a
 * "not configured" state, not an error — it must not throw an exception per
 * string, log on every language switch, or make the app look broken. It is
 * reported exactly once, with the fix.
 */
let tableMissing = false;

const MISSING_TABLE_HINT =
  'ugcTranslationService: hr_ugc_translations does not exist — manual translations ' +
  'are disabled until migration 018_hr_ugc_translations.sql is applied ' +
  '(`supabase db push`). Machine translation is unaffected.';

const isMissingTable = (error) =>
  error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');

const fail = (error, context) => {
  if (isMissingTable(error)) {
    if (!tableMissing) {
      tableMissing = true;
      console.warn(MISSING_TABLE_HINT);
    }
    return { success: false, error: 'not-configured', notConfigured: true };
  }
  console.error(`ugcTranslationService: ${context}`, error);
  return { success: false, error: error?.message || String(error) };
};

/** True once the schema is known to be missing, so callers can skip the trip. */
export const isTranslationStoreAvailable = () => !tableMissing;

/**
 * Every stored translation for one locale.
 *
 * Loaded wholesale rather than per-string: the row count is bounded by how much
 * text humans have actually translated (tens to low thousands), and a single
 * request is what lets peekManualTranslation() stay synchronous — a translation
 * that arrives one render late shows the machine draft first and then visibly
 * swaps, which is exactly the flicker this table exists to remove.
 */
export const fetchLocaleTranslations = async (locale) => {
  if (isDemoMode() || !locale || tableMissing) return ok([]);

  try {
    const { data, error } = await supabase
      .from('hr_ugc_translations')
      .select('entity_type, entity_id, field, locale, body, source_text, provider, updated_at')
      .eq('locale', locale);

    if (error) throw error;
    return ok(data || []);
  } catch (error) {
    return fail(error, 'fetchLocaleTranslations');
  }
};

/**
 * Minimal, complete dataset used to calculate Studio coverage.
 *
 * Coverage used to be assembled from nine independent locale requests. A
 * single failed request was silently ignored, leaving the persisted rows
 * correct while the source counters stayed artificially low. Read every locale
 * through one paginated path instead, and let the Studio reject the snapshot if
 * this request fails.
 */
export const fetchTranslationCoverage = async () => {
  if (isDemoMode() || tableMissing) return ok([]);

  const pageSize = 1000;
  const rows = [];

  try {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('hr_ugc_translations')
        .select('entity_type, entity_id, field, locale, body')
        .order('entity_type')
        .order('entity_id')
        .order('field')
        .order('locale')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return ok(rows);
  } catch (error) {
    return fail(error, 'fetchTranslationCoverage');
  }
};

/** Every locale's translations for one record — what the Studio's editor edits. */
export const fetchRecordTranslations = async (entityType, entityId) => {
  if (isDemoMode() || tableMissing) return ok([]);

  try {
    const { data, error } = await supabase
      .from('hr_ugc_translations')
      .select('entity_type, entity_id, field, locale, body, source_text, provider, updated_at')
      .eq('entity_type', entityType)
      .eq('entity_id', String(entityId));

    if (error) throw error;
    return ok(data || []);
  } catch (error) {
    return fail(error, 'fetchRecordTranslations');
  }
};

/**
 * Writes one field's translation. An empty body deletes instead of storing a
 * blank: a row that says "translated to nothing" would beat the machine draft
 * and blank the text on screen.
 */
export const saveTranslation = async ({
  entityType,
  entityId,
  field,
  locale,
  body,
  sourceText,
  provider = 'manual',
  updatedBy = null,
}) => {
  if (isDemoMode()) {
    return { success: false, error: 'Translations cannot be saved in demo mode' };
  }

  const value = (body ?? '').trim();
  if (!value) {
    return deleteTranslation({ entityType, entityId, field, locale });
  }

  try {
    const { data, error } = await supabase
      .from('hr_ugc_translations')
      .upsert(
        {
          entity_type: entityType,
          entity_id: String(entityId),
          field,
          locale,
          body: value,
          source_text: normalizeSource(sourceText),
          provider,
          updated_by: updatedBy,
        },
        { onConflict: 'entity_type,entity_id,field,locale' }
      )
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error) {
    return fail(error, 'saveTranslation');
  }
};

export const deleteTranslation = async ({ entityType, entityId, field, locale }) => {
  if (isDemoMode()) {
    return { success: false, error: 'Translations cannot be deleted in demo mode' };
  }

  try {
    const { error } = await supabase
      .from('hr_ugc_translations')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', String(entityId))
      .eq('field', field)
      .eq('locale', locale);

    if (error) throw error;
    return ok(null);
  } catch (error) {
    return fail(error, 'deleteTranslation');
  }
};

/** Saves a whole locale tab in one round trip. */
export const saveTranslationBatch = async (entries, updatedBy = null) => {
  if (isDemoMode()) {
    return { success: false, error: 'Translations cannot be saved in demo mode' };
  }

  const rows = [];
  const removals = [];

  entries.forEach((entry) => {
    const value = (entry.body ?? '').trim();
    if (value) {
      rows.push({
        entity_type: entry.entityType,
        entity_id: String(entry.entityId),
        field: entry.field,
        locale: entry.locale,
        body: value,
        source_text: normalizeSource(entry.sourceText),
        provider: entry.provider || 'manual',
        updated_by: updatedBy,
      });
    } else {
      removals.push(entry);
    }
  });

  try {
    if (rows.length) {
      const { error } = await supabase
        .from('hr_ugc_translations')
        .upsert(rows, { onConflict: 'entity_type,entity_id,field,locale' });
      if (error) throw error;
    }

    // Cleared fields are deletes, and there is no bulk form of a four-column
    // composite-key delete in PostgREST — but only fields the editor actually
    // blanked land here, so this stays a handful of requests at most.
    for (const entry of removals) {
      const result = await deleteTranslation(entry);
      if (!result.success) throw new Error(result.error);
    }

    return ok({ saved: rows.length, removed: removals.length });
  } catch (error) {
    return fail(error, 'saveTranslationBatch');
  }
};

/**
 * The Studio's work queue: every translatable string across all four sources,
 * flattened to one row per (record, field).
 *
 * Employee names are joined in for display only — they are proper nouns and are
 * never themselves translatable.
 */
export const fetchTranslatableRecords = async ({ entityTypes = ENTITY_TYPES, limit = 500 } = {}) => {
  if (isDemoMode()) return ok([]);

  try {
    const results = await Promise.all(
      entityTypes.map(async (entityType) => {
        const config = TRANSLATABLE_ENTITIES[entityType];
        if (!config) return [];

        const columns = [...new Set(['id', 'employee_id', config.titleField, ...config.fields])];

        // The employee embed and the updated_at sort are both presentational,
        // and both depend on schema PostgREST may not expose (a declared FK, an
        // updated_at column). Losing them must not cost the whole source, so
        // the request degrades to plain columns rather than failing.
        let data = null;
        const rich = await supabase
          .from(config.table)
          .select(`${columns.join(', ')}, updated_at, employee:employee_id(id, name)`)
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (rich.error) {
          const plain = await supabase
            .from(config.table)
            .select(columns.join(', '))
            .limit(limit);

          if (plain.error) {
            // One unusable table must not blank the whole queue — the other
            // three sources are still perfectly good.
            console.warn(`ugcTranslationService: skipping ${config.table}`, plain.error.message);
            return [];
          }
          data = plain.data;
        } else {
          data = rich.data;
        }

        return (data || []).flatMap((row) =>
          config.fields
            .map((field) => ({ field, text: normalizeSource(row[field]) }))
            .filter(({ text }) => text.length > 0)
            .map(({ field, text }) => ({
              entityType,
              entityId: String(row.id),
              field,
              sourceText: text,
              recordLabel: normalizeSource(row[config.titleField]) || String(row.id),
              employeeName: row.employee?.name || '',
              updatedAt: row.updated_at || null,
              key: recordKey(entityType, row.id, field),
            }))
        );
      })
    );

    return ok(results.flat());
  } catch (error) {
    return fail(error, 'fetchTranslatableRecords');
  }
};

/**
 * Turns loaded rows into the two indexes the render path consults.
 *
 * byRecord wins over byText: a per-record translation was written with that
 * record in front of the author, whereas a text match is an inference — correct
 * almost always, but "Closed" on a task and "Closed" on a leave request can
 * legitimately differ in a gendered or cased target language.
 */
export const buildTranslationIndex = (rows = []) => {
  const byRecord = new Map();
  const byText = new Map();

  rows.forEach((row) => {
    const body = (row.body ?? '').trim();
    if (!body) return;

    byRecord.set(recordKey(row.entity_type, row.entity_id, row.field), body);

    const source = normalizeSource(row.source_text);
    // Only exact, unambiguous matches are reusable. If two records disagree on
    // what the same sentence means, neither reading is safe to apply blindly to
    // a third record, so the text index drops the string entirely and those
    // records keep their own per-record entries.
    if (!source) return;
    if (byText.has(source) && byText.get(source) !== body) {
      byText.set(source, null);
      return;
    }
    if (!byText.has(source)) byText.set(source, body);
  });

  return { byRecord, byText };
};
