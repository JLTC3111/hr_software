import { readFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

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
let productionCreated = false;
const productionDatabase = `${database}_production`;
const attendanceMigration = '20260925093907_exclude_approved_leave_from_worked_days.sql';
const timeClockReadMigration = '20260926130934_optimize_time_clock_read_policy.sql';
const sqlFile = file => readFileSync(path.join(root, file), 'utf8');
const replayAttendance = db => psql(db, `BEGIN;\n${sqlFile(`supabase/migrations/${attendanceMigration}`)}\nCOMMIT;`);
const summaryFingerprint = db => psql(db, `SELECT jsonb_agg(to_jsonb(s)-'updated_at' ORDER BY employee_id,year,month) FROM public.time_tracking_summary s;`);
const runAttendanceCases = db => {
  console.log(psql(db, sqlFile('tests/database/attendance-regressions.sql')));
  const before = summaryFingerprint(db);
  const rows = psql(db, 'SELECT jsonb_agg(t ORDER BY id) FROM public.time_entries t;');
  replayAttendance(db);
  if (summaryFingerprint(db) !== before || psql(db, 'SELECT jsonb_agg(t ORDER BY id) FROM public.time_entries t;') !== rows) {
    throw new Error('Attendance migration replay changed attendance or summary values');
  }
  console.log('Verified accidental replay preserves rows and calculated values');
  const migration = sqlFile(`supabase/migrations/${attendanceMigration}`);
  psql(db, `BEGIN;\n${migration}\n${migration}\nCOMMIT;`);
  if (summaryFingerprint(db) !== before || psql(db, 'SELECT jsonb_agg(t ORDER BY id) FROM public.time_entries t;') !== rows) {
    throw new Error('Repeated migration within one transaction changed data');
  }
  console.log('Verified two replays in one transaction preserve rows and calculated values');
};
const concurrentSession = db => {
  const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db]);
  let output = '', errors = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { errors += data; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(errors)));
  });
  return { child, done, output: () => output };
};
const waitFor = async predicate => {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Concurrent database test timed out');
    await new Promise(resolve => setTimeout(resolve, 40));
  }
};
const runConcurrencyCases = async db => {
  const auth = `SET SESSION AUTHORIZATION authenticator; SET ROLE authenticated;
    SET request.jwt.claims='{"role":"authenticated","sub":"90000000-0000-0000-0000-000000000003"}';`;
  for (const [index, approvalFirst] of [false, true].entries()) {
    const date = `2029-10-0${index + 1}`;
    const fill = `WITH inserted AS (INSERT INTO public.time_entries(employee_id,date,clock_in,clock_out,hours,hour_type,status,notes)
      VALUES('att-b','${date}','09:00','17:00',8,'regular','approved','Standard hours filled by admin: race') RETURNING id) SELECT count(*) FROM inserted;`;
    const approve = `INSERT INTO public.leave_requests(employee_id,leave_type,start_date,end_date,status,reason)
      VALUES('att-b','annual','${date}','${date}','approved','race');`;
    const first = concurrentSession(db), second = concurrentSession(db);
    try {
      first.child.stdin.write(`${auth} BEGIN; SET LOCAL statement_timeout='15s'; ${approvalFirst ? approve : fill} SELECT 'READY';\n`);
      await waitFor(() => first.output().includes('READY'));
      second.child.stdin.end(`${auth} SET statement_timeout='15s'; SET application_name='attendance_race_waiter'; ${approvalFirst ? fill : approve}\n`);
      await waitFor(() => psql(db, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='attendance_race_waiter' AND wait_event='advisory');`) === 't');
      first.child.stdin.end('COMMIT;\n');
      const [, result] = await Promise.all([first.done, second.done]);
      if (approvalFirst && result.trim() !== '0') throw new Error('Guard reported a skipped row as inserted');
      psql(db, `SELECT attendance_audit.assert(
        NOT EXISTS(SELECT 1 FROM public.time_entries WHERE employee_id='att-b' AND date='${date}')
        AND (SELECT leave_days=${index + 1} AND total_hours=0 AND days_worked=0 FROM public.time_tracking_summary WHERE employee_id='att-b' AND year=2029 AND month=10),
        'DB${41 + index} ${approvalFirst ? 'approval then fill' : 'fill then approval'} concurrency closes at READ COMMITTED');`);
    } finally {
      first.child.stdin.end(); second.child.stdin.end();
      await Promise.allSettled([first.done, second.done]);
    }
  }
  console.log('2 two-session READ COMMITTED race cases passed');
};
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
  console.log(psql(database, sqlFile('tests/database/time-clock-read-policy.sql')));

  // Separate databases keep the original access regressions independent from
  // attendance fixtures. Production has not received the access-hardening
  // migration; reproduce its captured functions, ACLs, policies and bindings.
  psql('postgres', `CREATE DATABASE ${productionDatabase};`);
  productionCreated = true;
  psql(productionDatabase, sqlFile('tests/database/platform.sql'));
  psql(productionDatabase, sqlFile('supabase/migrations/20260922065611_audited_hr_baseline.sql'));
  const snapshot = JSON.parse(sqlFile('tests/database/attendance-production-catalog.json'));
  const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
  for (const fn of [...snapshot.functions, ...snapshot.catalog.helpers]) psql(productionDatabase, fn.definition);
  for (const table of snapshot.catalog.tables) {
    psql(productionDatabase, `REVOKE ALL ON public.${quote(table.name)} FROM PUBLIC,anon,authenticated,service_role;`);
    for (const acl of table.acl) {
      const role = acl.split('=')[0];
      if (role !== 'postgres') psql(productionDatabase, `GRANT ALL ON public.${quote(table.name)} TO ${role ? quote(role) : 'PUBLIC'};`);
    }
  }
  for (const trigger of snapshot.catalog.triggers) psql(productionDatabase,
    `DROP TRIGGER IF EXISTS ${quote(trigger.name)} ON public.${quote(trigger.table)}; ${trigger.definition};`);
  // Assert matching RLS policies before using this as the audit replay target.
  const policies = JSON.parse(psql(productionDatabase, `SELECT json_agg(p) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('employees','time_entries','leave_requests','overtime_logs','time_tracking_summary');`));
  const sorted = rows => JSON.stringify(rows.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort());
  if (sorted(policies) !== sorted(snapshot.catalog.policies)) throw new Error('Baseline RLS differs from captured production catalog');
  psql(productionDatabase, sqlFile(`supabase/migrations/${timeClockReadMigration}`));
  console.log(psql(productionDatabase, sqlFile('tests/database/time-clock-read-policy.sql')));
  psql(productionDatabase, sqlFile('tests/database/attendance-fixture.sql'));
  replayAttendance(productionDatabase);
  if (psql(productionDatabase, `SELECT prosecdef FROM pg_proc WHERE oid='public.update_time_tracking_summary(text,integer,integer)'::regprocedure`) !== 'f') {
    throw new Error('Production INVOKER was elevated');
  }
  console.log('Production catalog replay: SECURITY INVOKER');
  runAttendanceCases(productionDatabase);
  await runConcurrencyCases(productionDatabase);

  // Reuse the first disposable DB after resetting it, to test the undeployed
  // hardened wrapper before consolidation as a distinct upgrade path.
  psql('postgres', `DROP DATABASE ${database}; CREATE DATABASE ${database};`);
  psql(database, sqlFile('tests/database/platform.sql'));
  for (const migration of migrations.filter(file => file !== attendanceMigration)) {
    psql(database, `BEGIN;\n${sqlFile(`supabase/migrations/${migration}`)}\nCOMMIT;`);
  }
  psql(database, sqlFile('tests/database/attendance-fixture.sql'));
  replayAttendance(database);
  console.log('Repository access-hardening replay: existing effective DEFINER retained');
  runAttendanceCases(database);
  await runConcurrencyCases(database);
} finally {
  if (productionCreated) psql('postgres', `DROP DATABASE ${productionDatabase};`);
  if (created) psql('postgres', `DROP DATABASE ${database};`);
}
