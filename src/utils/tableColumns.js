/**
 * Column-priority vocabulary for wide data tables on narrow screens.
 *
 * Two mechanisms, meant to be combined:
 *
 * 1. Column priority — lower-value columns drop out as the viewport narrows
 *    (`COL.md`, `COL.lg`, `COL.xl`). Anything hidden this way must stay
 *    reachable, so pair it with <StackedDetail> in the row's primary cell.
 * 2. Empty-column elision — a column carrying no data for the current rows is
 *    dropped at every width via `hasAnyValue`.
 *
 * Horizontal scrolling stays the last resort: <TableScroll> keeps its own
 * overflow context so a wide table never makes the page body scroll sideways.
 */

/**
 * Breakpoint at which a column appears. Spread onto both <th> and <td> so a
 * header and its cells disappear together.
 */
export const COL = {
  /** Always visible — identity, and the one metric the table exists to show. */
  always: '',
  /** Secondary detail; hidden on phones. */
  md: 'hidden md:table-cell',
  /** Tertiary detail; hidden on phones and small tablets. */
  lg: 'hidden lg:table-cell',
  /** Nice-to-have; widescreen only. */
  xl: 'hidden xl:table-cell',
};

/** Mirror of COL for the stacked fallback: shown exactly when the column is not. */
export const COL_FALLBACK = {
  always: 'hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
};

/**
 * True when at least one row carries a value for this column, i.e. the column
 * has earned its slot. Blank strings, null, undefined and '-' all count as empty.
 */
export const hasAnyValue = (rows = [], accessor) =>
  (rows || []).some((row) => {
    const value = typeof accessor === 'function' ? accessor(row) : row?.[accessor];
    if (value === null || value === undefined || value === false) return false;
    const text = String(value).trim();
    return text !== '' && text !== '-';
  });
