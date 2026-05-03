import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearCommand } from './clear.js';

describe('clearCommand', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-clear-test-'));
    writeFileSync(
      join(tempDir, 'dcache.config.json'),
      JSON.stringify({
        cacheDir: join(tempDir, 'cache'),
        logLevel: 'error',
      }),
    );
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
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
