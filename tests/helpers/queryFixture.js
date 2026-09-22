export function queryFixture(tables = {}, errors = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      let rows = [...(tables[table] || [])];
      let single = false;
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
        if (method === 'range') rows = rows.slice(key, value + 1);
        if (method === 'single' || method === 'maybeSingle') single = true;
        if (method === 'insert') rows = Array.isArray(key) ? key : [key];
        if (method === 'update') rows = rows.map(row => ({ ...row, ...key }));
        return chain;
      };
      for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'not', 'order', 'limit', 'range', 'single', 'maybeSingle', 'insert', 'update', 'delete']) {
        chain[method] = (...args) => invoke(method, args);
      }
      chain.then = (resolve, reject) => {
        const error = typeof errors[table] === 'function' ? errors[table](queryCalls) : errors[table];
        return Promise.resolve({ data: error ? null : single ? rows[0] || null : rows, error: error || null, count: rows.length }).then(resolve, reject);
      };
      return chain;
    },
  };
}
