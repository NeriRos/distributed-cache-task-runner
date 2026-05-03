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
    outputs: [],
    hitCount: 0,
    ...overrides,
  };
}

function makeFakePool() {
  const store = new Map<string, Record<string, unknown>>();
  const artifacts = new Map<string, Buffer>();
  const calls: { text: string; values?: unknown[] }[] = [];

  const query = vi.fn(async (text: string, values?: unknown[]) => {
    calls.push({ text, values });
    const trimmed = text.trim();

    if (trimmed.startsWith('CREATE TABLE') || trimmed.startsWith('ALTER TABLE')) {
      return { rows: [] };
    }
    if (trimmed.includes('_artifacts') && trimmed.startsWith('INSERT')) {
      const [hash, data] = values ?? [];
      artifacts.set(hash as string, data as Buffer);
      return { rows: [] };
    }
    if (trimmed.includes('_artifacts') && trimmed.startsWith('SELECT')) {
      const hash = values?.[0] as string;
      const data = artifacts.get(hash);
      return { rows: data ? [{ data }] : [] };
    }
    if (trimmed.startsWith('INSERT')) {
      const [hash, task, exit_code, stdout, stderr, created_at, duration_ms, outputs, hit_count] = values ?? [];
      const parsedOutputs = typeof outputs === 'string' ? JSON.parse(outputs) : outputs;
      store.set(hash as string, { hash, task, exit_code, stdout, stderr, created_at, duration_ms, outputs: parsedOutputs, hit_count });
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
      if (trimmed.includes('_artifacts')) artifacts.clear();
      else store.clear();
      return { rows: [] };
    }
    if (trimmed.startsWith('DELETE') && trimmed.includes('_artifacts') && trimmed.includes('IN (')) {
      const cutoff = Date.parse(values?.[0] as string);
      for (const [hash, row] of store) {
        if (Date.parse(row.created_at as string) < cutoff) artifacts.delete(hash);
      }
      return { rows: [] };
    }
    if (trimmed.startsWith('DELETE') && trimmed.includes('_artifacts')) {
      const hash = values?.[0] as string;
      artifacts.delete(hash);
      return { rows: [] };
    }
    if (trimmed.startsWith('DELETE') && trimmed.includes('RETURNING hash')) {
      const cutoff = Date.parse(values?.[0] as string);
      const removed: { hash: string }[] = [];
      for (const [hash, row] of store) {
        if (Date.parse(row.created_at as string) < cutoff) {
          store.delete(hash);
          removed.push({ hash });
        }
      }
      return { rows: removed };
    }
    if (trimmed.startsWith('DELETE')) {
      const hash = values?.[0] as string;
      store.delete(hash);
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${text}`);
  });

  const pool: PostgresqlPool = { query: query as PostgresqlPool['query'] };
  return { pool, query, calls, store, artifacts };
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
    const entry = makeCacheEntry({ hash: 'h1', outputs: ['dist/index.js'] });

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

    const createEntries = calls.filter(
      (c) => c.text.trim().startsWith('CREATE TABLE') && c.text.includes('dcache_entries (') && !c.text.includes('_artifacts'),
    );
    expect(createEntries).toHaveLength(1);
  });

  it('uses the configured table name', async () => {
    const { pool, calls } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool, table: 'custom_cache' });
    await provider.set('h1', makeCacheEntry({ hash: 'h1' }));

    expect(calls.some((c) => c.text.includes('custom_cache'))).toBe(true);
  });

  it('round-trips an artifact', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    const data = Buffer.from('hello-tarball');
    await provider.setArtifact('h1', data);
    const got = await provider.getArtifact('h1');
    expect(got?.equals(data)).toBe(true);
  });

  it('returns null for missing artifact', async () => {
    const { pool } = makeFakePool();
    const provider = new PostgresqlCacheProvider({ pool });
    expect(await provider.getArtifact('missing')).toBeNull();
  });

  describe('TTL', () => {
    it('get returns null and evicts expired entry + artifact', async () => {
      const { pool, store, artifacts } = makeFakePool();
      const provider = new PostgresqlCacheProvider({ pool, ttlSeconds: 60 });
      const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await provider.set('h1', makeCacheEntry({ hash: 'h1', createdAt: stale }));
      await provider.setArtifact('h1', Buffer.from('data'));

      expect(await provider.get('h1')).toBeNull();
      expect(store.has('h1')).toBe(false);
      expect(artifacts.has('h1')).toBe(false);
    });

    it('get returns fresh entry when within TTL', async () => {
      const { pool } = makeFakePool();
      const provider = new PostgresqlCacheProvider({ pool, ttlSeconds: 3600 });
      const entry = makeCacheEntry({ hash: 'h1', createdAt: new Date().toISOString() });
      await provider.set('h1', entry);
      expect(await provider.get('h1')).toEqual(entry);
    });

    it('prune removes expired rows and returns the count', async () => {
      const { pool, store, artifacts } = makeFakePool();
      const provider = new PostgresqlCacheProvider({ pool, ttlSeconds: 60 });
      await provider.set('stale', makeCacheEntry({ hash: 'stale', createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }));
      await provider.setArtifact('stale', Buffer.from('s'));
      await provider.set('fresh', makeCacheEntry({ hash: 'fresh', createdAt: new Date().toISOString() }));

      expect(await provider.prune()).toBe(1);
      expect(store.has('stale')).toBe(false);
      expect(artifacts.has('stale')).toBe(false);
      expect(store.has('fresh')).toBe(true);
    });

    it('prune is a no-op without ttlSeconds', async () => {
      const { pool, store } = makeFakePool();
      const provider = new PostgresqlCacheProvider({ pool });
      await provider.set('h1', makeCacheEntry({ hash: 'h1', createdAt: '2000-01-01T00:00:00Z' }));
      expect(await provider.prune()).toBe(0);
      expect(store.has('h1')).toBe(true);
    });
  });

  it('converts Date created_at from postgres back to ISO string', async () => {
    const date = new Date('2026-02-03T04:05:06.000Z');
    const pool: PostgresqlPool = {
      query: vi.fn(async (text: string) => {
        const trimmed = text.trim();
        if (trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER')) return { rows: [] };
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
              outputs: [],
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
