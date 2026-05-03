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
  private readonly artifactTable: string;
  private initPromise: Promise<void> | null = null;

  constructor({ pool, table = 'dcache_entries' }: PostgresqlCacheProviderOptions) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error(`Invalid postgres table name: ${table}`);
    }
    this.pool = pool;
    this.table = table;
    this.artifactTable = `${table}_artifacts`;
  }

  async get(hash: string): Promise<CacheEntry | null> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `SELECT hash, task, exit_code, stdout, stderr, created_at, duration_ms, outputs, hit_count
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
      outputs: (row.outputs as string[] | null) ?? [],
      hitCount: row.hit_count == null ? 0 : Number(row.hit_count),
    };
  }

  async set(hash: string, entry: CacheEntry): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO ${this.table}
         (hash, task, exit_code, stdout, stderr, created_at, duration_ms, outputs, hit_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (hash) DO UPDATE SET
         task = EXCLUDED.task,
         exit_code = EXCLUDED.exit_code,
         stdout = EXCLUDED.stdout,
         stderr = EXCLUDED.stderr,
         created_at = EXCLUDED.created_at,
         duration_ms = EXCLUDED.duration_ms,
         outputs = EXCLUDED.outputs,
         hit_count = EXCLUDED.hit_count`,
      [hash, entry.task, entry.exitCode, entry.stdout, entry.stderr, entry.createdAt, entry.durationMs, entry.outputs, entry.hitCount ?? 0],
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
    await this.pool.query(`TRUNCATE TABLE ${this.artifactTable}`);
  }

  async getArtifact(hash: string): Promise<Buffer | null> {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      `SELECT data FROM ${this.artifactTable} WHERE hash = $1`,
      [hash],
    );
    const row = rows[0];
    if (!row) return null;
    const data = row.data;
    if (data instanceof Buffer) return data;
    if (data instanceof Uint8Array) return Buffer.from(data);
    return null;
  }

  async setArtifact(hash: string, data: Buffer): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO ${this.artifactTable} (hash, data)
       VALUES ($1, $2)
       ON CONFLICT (hash) DO UPDATE SET data = EXCLUDED.data`,
      [hash, data],
    );
  }

  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runMigrations().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
         hash TEXT PRIMARY KEY,
         task TEXT NOT NULL,
         exit_code INTEGER NOT NULL,
         stdout TEXT NOT NULL,
         stderr TEXT NOT NULL,
         created_at TIMESTAMPTZ NOT NULL,
         duration_ms BIGINT NOT NULL,
         outputs JSONB NOT NULL DEFAULT '[]'::jsonb
       )`,
    );
    await this.pool.query(
      `ALTER TABLE ${this.table} ADD COLUMN IF NOT EXISTS outputs JSONB NOT NULL DEFAULT '[]'::jsonb`,
    );
    await this.pool.query(
      `ALTER TABLE ${this.table} ADD COLUMN IF NOT EXISTS hit_count BIGINT NOT NULL DEFAULT 0`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.artifactTable} (
         hash TEXT PRIMARY KEY,
         data BYTEA NOT NULL
       )`,
    );
  }
}
