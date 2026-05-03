import pg from 'pg';
import { PostgresqlCacheProvider } from './postgresql-provider.js';
import type { CacheEntry } from './cache-provider.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DCACHE_PG_URL ?? 'postgres://litrpg:litrpg_password@localhost:5432/dcache_test',
});

const provider = new PostgresqlCacheProvider({ pool, table: 'dcache_smoke' });

const entry: CacheEntry = {
  hash: 'smoke-' + Date.now(),
  task: 'lint',
  exitCode: 0,
  stdout: 'hello world',
  stderr: '',
  createdAt: new Date().toISOString(),
  durationMs: 123,
};

async function main() {
  console.log('clearing...');
  await provider.clear();

  console.log('has(missing) →', await provider.has(entry.hash));
  console.log('get(missing) →', await provider.get(entry.hash));

  console.log('set...');
  await provider.set(entry.hash, entry);

  console.log('has(present) →', await provider.has(entry.hash));
  const got = await provider.get(entry.hash);
  console.log('get(present) →', got);

  const ok =
    got !== null &&
    got.hash === entry.hash &&
    got.task === entry.task &&
    got.exitCode === entry.exitCode &&
    got.stdout === entry.stdout &&
    got.stderr === entry.stderr &&
    got.durationMs === entry.durationMs &&
    got.createdAt === entry.createdAt;

  console.log('roundtrip ok →', ok);

  console.log('overwrite...');
  await provider.set(entry.hash, { ...entry, stdout: 'updated' });
  const updated = await provider.get(entry.hash);
  console.log('updated stdout →', updated?.stdout);

  console.log('clearing...');
  await provider.clear();
  console.log('has(after clear) →', await provider.has(entry.hash));

  await pool.end();

  if (!ok || updated?.stdout !== 'updated') {
    console.error('SMOKE TEST FAILED');
    process.exit(1);
  }
  console.log('SMOKE TEST PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
