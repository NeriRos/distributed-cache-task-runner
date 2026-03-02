import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeHash } from './hasher.js';

describe('computeHash', () => {
  let tempDir: string;

  function makeTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-compute-hash-test-'));
    return tempDir;
  }

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns deterministic hash for same inputs', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');

    const opts = {
      files: [join(dir, 'a.ts')],
      taskManifest: { command: 'lint' },
    };

    const hash1 = await computeHash(opts);
    const hash2 = await computeHash(opts);
    expect(hash1).toBe(hash2);
  });

  it('returns a 64-char hex string', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'test');

    const hash = await computeHash({
      files: [join(dir, 'a.ts')],
      taskManifest: { task: 'build' },
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('includes lock file in hash when provided', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');
    writeFileSync(join(dir, 'lock'), 'lock-content');

    const withoutLock = await computeHash({
      files: [join(dir, 'a.ts')],
      taskManifest: { command: 'lint' },
    });

    const withLock = await computeHash({
      files: [join(dir, 'a.ts')],
      lockFilePath: join(dir, 'lock'),
      taskManifest: { command: 'lint' },
    });

    expect(withoutLock).not.toBe(withLock);
  });

  it('changes when lock file content changes', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');
    const lockFile = join(dir, 'lock');

    writeFileSync(lockFile, 'v1');
    const hash1 = await computeHash({
      files: [join(dir, 'a.ts')],
      lockFilePath: lockFile,
      taskManifest: { command: 'lint' },
    });

    writeFileSync(lockFile, 'v2');
    const hash2 = await computeHash({
      files: [join(dir, 'a.ts')],
      lockFilePath: lockFile,
      taskManifest: { command: 'lint' },
    });

    expect(hash1).not.toBe(hash2);
  });

  it('changes when task manifest changes', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');

    const hash1 = await computeHash({
      files: [join(dir, 'a.ts')],
      taskManifest: { command: 'lint' },
    });

    const hash2 = await computeHash({
      files: [join(dir, 'a.ts')],
      taskManifest: { command: 'typecheck' },
    });

    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash for equivalent manifests regardless of key order', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');

    const hash1 = await computeHash({
      files: [join(dir, 'a.ts')],
      taskManifest: { command: 'lint', project: 'mylib' },
    });

    const hash2 = await computeHash({
      files: [join(dir, 'a.ts')],
      taskManifest: { project: 'mylib', command: 'lint' },
    });

    expect(hash1).toBe(hash2);
  });
});
