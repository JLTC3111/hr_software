import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { fetchAllRows } from '../src/utils/fetchAllRows.js';

const fixture = (changeCount = false, failPage = false) => {
  const offsets = [];
  const client = createClient('https://fixture.supabase.co', 'fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input);
      const offset = Number(url.searchParams.get('offset'));
      offsets.push(offset);
      assert.equal(url.searchParams.get('order'), 'date.asc,id.asc');
      assert.match(new Headers(options.headers).get('prefer'), /count=exact/);
      if (failPage && offset > 0) return new Response(JSON.stringify({ message: 'Page failed' }), { status: 500 });
      const total = changeCount && offset > 0 ? 6 : 5;
      const rows = Array.from({ length: Math.min(2, total - offset) }, (_, i) => ({ id: offset + i }));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Range': `${offset}-${offset + rows.length - 1}/${total}`, 'Content-Type': 'application/json' } });
    } },
  });
  return { offsets, query: client.from('time_entries').select('id', { count: 'exact' }).order('date') };
};

test('installed SDK paginates inclusive ranges under a lower server cap with deterministic ordering', async () => {
  const { query, offsets } = fixture();
  const result = await fetchAllRows(query);
  assert.equal(result.error, null);
  assert.deepEqual(result.data.map(row => row.id), [0, 1, 2, 3, 4]);
  assert.deepEqual(offsets, [0, 2, 4]);
});

test('pagination failure or a changing result count never returns partial successful totals', async () => {
  for (const flags of [[true, false], [false, true]]) {
    const result = await fetchAllRows(fixture(...flags).query);
    assert.equal(result.data, null);
    assert.ok(result.error);
  }
});
