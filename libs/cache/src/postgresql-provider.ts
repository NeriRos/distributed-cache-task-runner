import type { CacheEntry, CacheProvider } from './cache-provider.js';

export interface PostgresqlPool {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface PostgresqlCacheProviderOptions {
  pool: PostgresqlPool;
  table?: string;
}

export class PostgresqlCacheProvider implements CacheProvider {
  private readonly pool: PostgresqlPool;
  private readonly table: string;
  private initPromise: Promise<void> | null = null;

  constructor({ pool, table = 'dcache_entries' }: PostgresqlCacheProviderOptions) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error(`Invalid postgres table name: ${table}`);
    }
    this.pool = pool;
    this.table = table;
  }

  async get(hash: string): Promise<CacheEntry | null> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `SELECT hash, task, exit_code, stdout, stderr, created_at, duration_ms
       FROM ${this.table} WHERE hash = $1`,
      [hash],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      hash: row.hash as string,
      task: row.task as string,
      exitCode: Number(row.exit_code),
      stdout: row.stdout as string,
      stderr: row.stderr as string,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      durationMs: Number(row.duration_ms),
    };
  }

  async set(hash: string, entry: CacheEntry): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO ${this.table}
         (hash, task, exit_code, stdout, stderr, created_at, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (hash) DO UPDATE SET
         task = EXCLUDED.task,
         exit_code = EXCLUDED.exit_code,
         stdout = EXCLUDED.stdout,
         stderr = EXCLUDED.stderr,
         created_at = EXCLUDED.created_at,
         duration_ms = EXCLUDED.duration_ms`,
      [hash, entry.task, entry.exitCode, entry.stdout, entry.stderr, entry.createdAt, entry.durationMs],
    );
  }

  async has(hash: string): Promise<boolean> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `SELECT 1 FROM ${this.table} WHERE hash = $1 LIMIT 1`,
      [hash],
    );
    return rows.length > 0;
  }

  async clear(): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(`TRUNCATE TABLE ${this.table}`);
  }

  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.pool
        .query(
          `CREATE TABLE IF NOT EXISTS ${this.table} (
             hash TEXT PRIMARY KEY,
             task TEXT NOT NULL,
             exit_code INTEGER NOT NULL,
             stdout TEXT NOT NULL,
             stderr TEXT NOT NULL,
             created_at TIMESTAMPTZ NOT NULL,
             duration_ms BIGINT NOT NULL
           )`,
        )
        .then(() => undefined)
        .catch((err) => {
          this.initPromise = null;
          throw err;
        });
    }
    return this.initPromise;
  }
}
