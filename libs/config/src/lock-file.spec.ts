import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findLockFile } from './lock-file.js';

describe('findLockFile', () => {
  let tempDir: string;

  function makeTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-test-'));
    return tempDir;
  }

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null when no lock file exists', () => {
    const dir = makeTempDir();
    expect(findLockFile(dir)).toBeNull();
  });

  it('finds bun.lockb', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'bun.lockb'), '');
    expect(findLockFile(dir)).toBe(join(dir, 'bun.lockb'));
  });

  it('finds bun.lock', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'bun.lock'), '');
    expect(findLockFile(dir)).toBe(join(dir, 'bun.lock'));
  });

  it('finds package-lock.json', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package-lock.json'), '{}');
    expect(findLockFile(dir)).toBe(join(dir, 'package-lock.json'));
  });

  it('finds yarn.lock', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'yarn.lock'), '');
    expect(findLockFile(dir)).toBe(join(dir, 'yarn.lock'));
  });

  it('finds pnpm-lock.yaml', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
    expect(findLockFile(dir)).toBe(join(dir, 'pnpm-lock.yaml'));
  });

  it('prefers bun.lockb over other lock files', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'bun.lockb'), '');
    writeFileSync(join(dir, 'package-lock.json'), '{}');
    writeFileSync(join(dir, 'yarn.lock'), '');
    expect(findLockFile(dir)).toBe(join(dir, 'bun.lockb'));
  });

  it('returns bun.lock when bun.lockb is absent', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'bun.lock'), '');
    writeFileSync(join(dir, 'yarn.lock'), '');
    expect(findLockFile(dir)).toBe(join(dir, 'bun.lock'));
  });
});
