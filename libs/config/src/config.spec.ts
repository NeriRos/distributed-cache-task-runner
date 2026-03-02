import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  let tempDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  function makeTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-config-test-'));
    return tempDir;
  }

  beforeEach(() => {
    savedEnv['DCACHE_CACHE_DIR'] = process.env['DCACHE_CACHE_DIR'];
    savedEnv['DCACHE_LOG_LEVEL'] = process.env['DCACHE_LOG_LEVEL'];
    delete process.env['DCACHE_CACHE_DIR'];
    delete process.env['DCACHE_LOG_LEVEL'];
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns default config when no config file or env vars', () => {
    const dir = makeTempDir();
    const config = loadConfig(dir);
    expect(config.cacheDir).toBe(
      join(dir, 'node_modules', '.cache', 'dcache')
    );
    expect(config.logLevel).toBe('info');
  });

  it('reads cacheDir from config file', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'dcache.config.json'),
      JSON.stringify({ cacheDir: '/custom/cache' })
    );
    const config = loadConfig(dir);
    expect(config.cacheDir).toBe('/custom/cache');
  });

  it('reads logLevel from config file', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'dcache.config.json'),
      JSON.stringify({ logLevel: 'debug' })
    );
    const config = loadConfig(dir);
    expect(config.logLevel).toBe('debug');
  });

  it('env vars override config file', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'dcache.config.json'),
      JSON.stringify({ cacheDir: '/from-file', logLevel: 'debug' })
    );
    process.env['DCACHE_CACHE_DIR'] = '/from-env';
    process.env['DCACHE_LOG_LEVEL'] = 'error';
    const config = loadConfig(dir);
    expect(config.cacheDir).toBe('/from-env');
    expect(config.logLevel).toBe('error');
  });

  it('ignores invalid logLevel in config file', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'dcache.config.json'),
      JSON.stringify({ logLevel: 'verbose' })
    );
    const config = loadConfig(dir);
    expect(config.logLevel).toBe('info');
  });

  it('ignores invalid logLevel in env var', () => {
    const dir = makeTempDir();
    process.env['DCACHE_LOG_LEVEL'] = 'verbose';
    const config = loadConfig(dir);
    expect(config.logLevel).toBe('info');
  });

  it('uses process.cwd() when no cwd argument provided', () => {
    const config = loadConfig();
    expect(config.cacheDir).toContain('node_modules/.cache/dcache');
  });
});
