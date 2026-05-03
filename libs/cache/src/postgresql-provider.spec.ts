import { describe, it, expect, vi } from 'vitest';
import { PostgresqlCacheProvider, type PostgresqlPool } from './postgresql-provider.js';
import type { CacheEntry } from './cache-provider.js';

function makeCacheEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    hash: 'abc123',
    task: 'lint',
    exitCode: 0,
    stdout: 'ok',
    stderr: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    durationMs: 100,
    ...overrides,
  };
}

function makeFakePool() {
  const store = new Map<string, Record<string, unknown>>();
  const calls: { text: string; values?: unknown[] }[] = [];

  const query = vi.fn(async (text: string, values?: unknown[]) => {
    calls.push({ text, values });
    const trimmed = text.trim();

    if (trimmed.startsWith('CREATE TABLE')) {
      return { rows: [] };
    }
    if (trimmed.startsWith('INSERT')) {
      const [hash, task, exit_code, stdout, stderr, created_at, duration_ms] = values ?? [];
      store.set(hash as string, { hash, task, exit_code, stdout, stderr, created_at, duration_ms });
      return { rows: [] };
    }
    if (trimmed.startsWith('SELECT 1')) {
      const hash = values?.[0] as string;
      return { rows: store.has(hash) ? [{ '?column?': 1 }] : [] };
    }
    if (trimmed.startsWith('SELECT')) {
      const hash = values?.[0] as string;
      const row = store.get(hash);
      return { rows: row ? [row] : [] };
    }
    if (trimmed.startsWith('TRUNCATE')) {
      store.clear();
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${text}`);
  });

  const pool: PostgresqlPool = { query: query as PostgresqlPool['query'] };
  return { pool, query, calls, store };
}

describe('PostgresqlCacheProvider', () => {
  it('rejects invalid table names', () => {
    const { pool } = makeFakePool();
    expect(() => new PostgresqlCacheProvider({ pool, table: 'bad; DROP TABLE x' })).toThrow();
  });

  it('returns null for missing entry', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    expect(await provider.get('nonexistent')).toBeNull();
  });

  it('has returns false for missing entry', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    expect(await provider.has('nonexistent')).toBe(false);
  });

  it('set then get returns the same entry', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    const entry = makeCacheEntry({ hash: 'h1' });

    await provider.set('h1', entry);
    expect(await provider.get('h1')).toEqual(entry);
  });

  it('has returns true after set', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    await provider.set('h1', makeCacheEntry({ hash: 'h1' }));
    expect(await provider.has('h1')).toBe(true);
  });

  it('clear removes all entries', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    await provider.set('h1', makeCacheEntry({ hash: 'h1' }));
    await provider.set('h2', makeCacheEntry({ hash: 'h2' }));

    await provider.clear();

    expect(await provider.has('h1')).toBe(false);
    expect(await provider.has('h2')).toBe(false);
  });

  it('initializes schema only once across calls', async () => {
    const { pool, calls } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });

    await provider.set('h1', makeCacheEntry({ hash: 'h1' }));
    await provider.get('h1');
    await provider.has('h1');

    const createCalls = calls.filter((c) => c.text.trim().startsWith('CREATE TABLE'));
    expect(createCalls).toHaveLength(1);
  });

  it('uses the configured table name', async () => {
    const { pool, calls } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool, table: 'custom_cache' });
    await provider.set('h1', makeCacheEntry({ hash: 'h1' }));

    expect(calls.some((c) => c.text.includes('custom_cache'))).toBe(true);
  });

  it('converts Date created_at from postgres back to ISO string', async () => {
    const date = new Date('2026-02-03T04:05:06.000Z');
    const pool: PostgresqlPool = {
      query: vi.fn(async (text: string) => {
        if (text.trim().startsWith('CREATE')) return { rows: [] };
        return {
          rows: [
            {
              hash: 'h1',
              task: 'lint',
              exit_code: 0,
              stdout: '',
              stderr: '',
              created_at: date,
              duration_ms: '42',
            },
          ],
        };
      }) as PostgresqlPool['query'],
    };
    const provider = new PostgresqlCacheProvider({ pool });
    const entry = await provider.get('h1');

    expect(entry?.createdAt).toBe('2026-02-03T04:05:06.000Z');
    expect(entry?.durationMs).toBe(42);
  });
});
