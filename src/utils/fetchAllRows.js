// Supabase caps each response. Read complete, stably ordered attendance sources.
// Callers request count: 'exact', so a smaller server cap is also supported.
export const fetchAllRows = async (query, { pageSize = 500, run = value => value } = {}) => {
  const rows = [];
  let expectedCount;
  query = query.order('id');
  for (;;) {
    const result = await run(query.range(rows.length, rows.length + pageSize - 1));
    if (result.error) return { ...result, data: null };
    const page = result.data || [];
    if (result.count != null) {
      if (expectedCount != null && expectedCount !== result.count) {
        return { data: null, error: new Error('Records changed while loading. Please retry.') };
      }
      expectedCount = result.count;
    }
    if (!page.length && expectedCount != null && rows.length < expectedCount) {
      return { data: null, error: new Error('Incomplete records returned. Please retry.') };
    }
    rows.push(...page);
    if (expectedCount != null ? rows.length >= expectedCount : page.length < pageSize) {
      return { ...result, data: rows };
    }
  }
};
