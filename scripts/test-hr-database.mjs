import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// This runner can only target the disposable local audit container. It never
// reads .env, a linked Supabase project, or a production connection string.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const container = 'hr-audit-postgres-20260922';
const database = `hr_regression_${process.pid}`;
const psql = (db, sql) => {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], {
    input: sql, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || result.stdout);
  return result.stdout.trim();
};

let created = false;
try {
  psql('postgres', `CREATE DATABASE ${database};`);
  created = true;
  psql(database, readFileSync(path.join(root, 'tests/database/platform.sql'), 'utf8'));
  const migrations = readdirSync(path.join(root, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort();
  for (const migration of migrations) {
    if (migration.includes('enforce_hr_access')) {
      psql(database, readFileSync(path.join(root, 'tests/database/upgrade-fixture.sql'), 'utf8'));
      let legacyGuardWorked = false;
      try {
        psql(database, `BEGIN;\n${readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8')}\nCOMMIT;`);
      } catch (error) {
        if (!error.message.includes('Map existing legacy interviews')) throw error;
        legacyGuardWorked = true;
      }
      if (!legacyGuardWorked) throw new Error('Repair accepted unmapped legacy interviews');
      if (psql(database, "SELECT public FROM storage.buckets WHERE id = 'employee-documents'") !== 't') {
        throw new Error('Rejected upgrade did not roll back');
      }
      psql(database, 'DELETE FROM public.interview_schedules WHERE id = 801;');
      console.log('Verified legacy-interview guard rolls back without discarding records');
    }
    psql(database, `BEGIN;\n${readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8')}\nCOMMIT;`);
    console.log(`Replayed ${migration}`);
  }
  console.log(psql(database, readFileSync(path.join(root, 'tests/database/hr-access.sql'), 'utf8')));
} finally {
  if (created) psql('postgres', `DROP DATABASE ${database};`);
}
