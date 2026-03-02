import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashFile, hashFiles } from './file-hasher.js';

describe('hashFile', () => {
  let tempDir: string;

  function makeTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-hasher-test-'));
    return tempDir;
  }

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns deterministic hash for same content', async () => {
    const dir = makeTempDir();
    const file = join(dir, 'a.txt');
    writeFileSync(file, 'hello world');

    const hash1 = await hashFile(file);
    const hash2 = await hashFile(file);
    expect(hash1).toBe(hash2);
  });

  it('returns a 64-char hex string (SHA-256)', async () => {
    const dir = makeTempDir();
    const file = join(dir, 'a.txt');
    writeFileSync(file, 'test');

    const hash = await hashFile(file);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hash for different content', async () => {
    const dir = makeTempDir();
    const fileA = join(dir, 'a.txt');
    const fileB = join(dir, 'b.txt');
    writeFileSync(fileA, 'content A');
    writeFileSync(fileB, 'content B');

    const hashA = await hashFile(fileA);
    const hashB = await hashFile(fileB);
    expect(hashA).not.toBe(hashB);
  });

  it('rejects for non-existent file', async () => {
    const dir = makeTempDir();
    await expect(hashFile(join(dir, 'missing.txt'))).rejects.toThrow();
  });
});

describe('hashFiles', () => {
  let tempDir: string;

  function makeTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-hasher-test-'));
    return tempDir;
  }

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns deterministic hash for same files', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');
    writeFileSync(join(dir, 'b.ts'), 'const b = 2;');

    const files = [join(dir, 'a.ts'), join(dir, 'b.ts')];
    const hash1 = await hashFiles(files);
    const hash2 = await hashFiles(files);
    expect(hash1).toBe(hash2);
  });

  it('produces same hash regardless of input order', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'const a = 1;');
    writeFileSync(join(dir, 'b.ts'), 'const b = 2;');

    const hash1 = await hashFiles([join(dir, 'a.ts'), join(dir, 'b.ts')]);
    const hash2 = await hashFiles([join(dir, 'b.ts'), join(dir, 'a.ts')]);
    expect(hash1).toBe(hash2);
  });

  it('returns different hash when file content changes', async () => {
    const dir = makeTempDir();
    const file = join(dir, 'a.ts');

    writeFileSync(file, 'version 1');
    const hash1 = await hashFiles([file]);

    writeFileSync(file, 'version 2');
    const hash2 = await hashFiles([file]);

    expect(hash1).not.toBe(hash2);
  });

  it('returns different hash for different file sets', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'a.ts'), 'a');
    writeFileSync(join(dir, 'b.ts'), 'b');

    const hash1 = await hashFiles([join(dir, 'a.ts')]);
    const hash2 = await hashFiles([join(dir, 'a.ts'), join(dir, 'b.ts')]);
    expect(hash1).not.toBe(hash2);
  });
});
