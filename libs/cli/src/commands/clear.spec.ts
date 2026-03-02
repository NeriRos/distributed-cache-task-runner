import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearCommand } from './clear.js';

describe('clearCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-clear-test-'));
    vi.stubEnv('DCACHE_CACHE_DIR', join(tempDir, 'cache'));
    vi.stubEnv('DCACHE_LOG_LEVEL', 'error');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('clears the cache directory and returns 0', async () => {
    const cacheDir = join(tempDir, 'cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'test.json'), '{}');

    const exitCode = await clearCommand();

    expect(exitCode).toBe(0);
    expect(existsSync(cacheDir)).toBe(false);
  });

  it('returns 0 even when cache does not exist', async () => {
    const exitCode = await clearCommand();
    expect(exitCode).toBe(0);
  });
});
