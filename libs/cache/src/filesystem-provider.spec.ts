import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FilesystemCacheProvider } from './filesystem-provider.js';
import type { CacheEntry } from './cache-provider.js';

function makeCacheEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    hash: 'abc123',
    task: 'lint',
    exitCode: 0,
    stdout: 'ok',
    stderr: '',
    createdAt: '2026-01-01T00:00:00Z',
    durationMs: 100,
    ...overrides,
  };
}

describe('FilesystemCacheProvider', () => {
  let tempDir: string;

  function makeTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-cache-test-'));
    return tempDir;
  }

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null for missing entry', async () => {
    const cacheDir = join(makeTempDir(), 'cache');
    const provider = new FilesystemCacheProvider(cacheDir);

    const result = await provider.get('nonexistent');
    expect(result).toBeNull();
  });

  it('has returns false for missing entry', async () => {
    const cacheDir = join(makeTempDir(), 'cache');
    const provider = new FilesystemCacheProvider(cacheDir);

    expect(await provider.has('nonexistent')).toBe(false);
  });

  it('set then get returns the same entry', async () => {
    const cacheDir = join(makeTempDir(), 'cache');
    const provider = new FilesystemCacheProvider(cacheDir);
    const hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const entry = makeCacheEntry({ hash });

    await provider.set(hash, entry);
    const result = await provider.get(hash);

    expect(result).toEqual(entry);
  });

  it('has returns true after set', async () => {
    const cacheDir = join(makeTempDir(), 'cache');
    const provider = new FilesystemCacheProvider(cacheDir);
    const hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const entry = makeCacheEntry({ hash });

    await provider.set(hash, entry);
    expect(await provider.has(hash)).toBe(true);
  });

  it('stores entries in 2-char prefix subdirectories', async () => {
    const cacheDir = join(makeTempDir(), 'cache');
    const provider = new FilesystemCacheProvider(cacheDir);
    const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const entry = makeCacheEntry({ hash });

    await provider.set(hash, entry);

    const prefixDir = join(cacheDir, 'ab');
    expect(existsSync(prefixDir)).toBe(true);
    const files = readdirSync(prefixDir);
    expect(files).toContain(`${hash}.json`);
  });

  it('clear removes all entries', async () => {
    const cacheDir = join(makeTempDir(), 'cache');
    const provider = new FilesystemCacheProvider(cacheDir);
    const hash1 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const hash2 = 'f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3b4a5f0e1';

    await provider.set(hash1, makeCacheEntry({ hash: hash1 }));
    await provider.set(hash2, makeCacheEntry({ hash: hash2 }));

    expect(await provider.has(hash1)).toBe(true);
    expect(await provider.has(hash2)).toBe(true);

    await provider.clear();

    expect(await provider.has(hash1)).toBe(false);
    expect(await provider.has(hash2)).toBe(false);
    expect(existsSync(cacheDir)).toBe(false);
  });

  it('clear is safe when cache dir does not exist', async () => {
    const cacheDir = join(makeTempDir(), 'nonexistent-cache');
    const provider = new FilesystemCacheProvider(cacheDir);

    await expect(provider.clear()).resolves.toBeUndefined();
  });
});
