/**
 * In-memory stand-in for the supabase-js query builder.
 *
 * By default every `from()` starts from the fixture rows and mutations only
 * shape the returned data. With `{ persist: true }` inserts, updates and
 * deletes are applied to the fixture tables when the chain resolves, so a test
 * can run several service calls against one evolving dataset.
 */
export function queryFixture(tables = {}, errors = {}, options = {}) {
  const persist = Boolean(options.persist);
  const calls = [];
  let sequence = 0;
  return {
    calls,
    tables,
    from(table) {
      if (persist && !tables[table]) tables[table] = [];
      const source = tables[table] || [];
      let rows = [...source];
      let single = false;
      let mutation = null;
      let range = null;
      const queryCalls = [];
      const chain = {};
      const invoke = (method, args) => {
        calls.push({ table, method, args });
        queryCalls.push({ method, args });
        const [key, value] = args;
        if (method === 'eq') rows = rows.filter(row => row[key] === value);
        if (method === 'gte') rows = rows.filter(row => row[key] >= value);
        if (method === 'lte') rows = rows.filter(row => row[key] <= value);
        if (method === 'in') rows = rows.filter(row => value.includes(row[key]));
        if (method === 'not') rows = rows.filter(row => row[key] !== args[2]);
        if (method === 'limit') rows = rows.slice(0, key);
        if (method === 'range') range = [key, value + 1];
        if (method === 'is') rows = rows.filter(row => (row[key] ?? null) === value);
        if (method === 'single' || method === 'maybeSingle') single = true;
        if (method === 'insert') {
          rows = (Array.isArray(key) ? key : [key]).map(row => ({ ...row }));
          mutation = { type: 'insert' };
        }
        if (method === 'update') {
          mutation = { type: 'update', payload: key };
        }
        if (method === 'delete') mutation = { type: 'delete' };
        return chain;
      };
      for (const method of ['select', 'is', 'eq', 'gte', 'lte', 'in', 'not', 'order', 'limit', 'range', 'single', 'maybeSingle', 'insert', 'update', 'delete']) {
        chain[method] = (...args) => invoke(method, args);
      }
      chain.then = (resolve, reject) => {
        const error = typeof errors[table] === 'function' ? errors[table](queryCalls) : errors[table];
        if (!error && persist && mutation) {
          if (mutation.type === 'insert') {
            rows.forEach(row => {
              if (row.id == null) row.id = `${table}-${++sequence}`;
              source.push(row);
            });
          }
          if (mutation.type === 'update') rows.forEach(row => Object.assign(row, mutation.payload));
          if (mutation.type === 'delete') {
            rows.forEach(row => {
              const index = source.indexOf(row);
              if (index >= 0) source.splice(index, 1);
            });
          }
        }
        // Persisted rows are handed out as snapshots, like a database would.
        const selected = range ? rows.slice(...range) : rows;
        const capped = options.maxRows ? selected.slice(0, options.maxRows) : selected;
        const out = mutation?.type === 'update' && !persist
          ? capped.map(row => ({ ...row, ...mutation.payload }))
          : persist ? capped.map(row => ({ ...row })) : capped;
        return Promise.resolve({ data: error ? null : single ? out[0] || null : out, error: error || null, count: rows.length }).then(resolve, reject);
      };
      return chain;
    },
  };
}
