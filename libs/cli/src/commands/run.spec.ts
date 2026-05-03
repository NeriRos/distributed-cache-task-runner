import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCommand } from './run.js';

describe('runCommand', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dcache-run-test-'));
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

  it('runs a command on cache miss and returns exit code', async () => {
    const srcFile = join(tempDir, 'test.ts');
    writeFileSync(srcFile, 'export const x = 1;');

    const exitCode = await runCommand({
      command: 'run',
      mode: 'glob',
      taskCommand: 'echo cache-miss-test',
      glob: join(tempDir, '*.ts'),
      extraArgs: [],
    });

    expect(exitCode).toBe(0);
  });

  it('returns cached result on cache hit', async () => {
    const srcFile = join(tempDir, 'test.ts');
    writeFileSync(srcFile, 'export const x = 1;');

    const parsed = {
      command: 'run' as const,
      mode: 'glob' as const,
      taskCommand: 'echo hit-test',
      glob: join(tempDir, '*.ts'),
      extraArgs: [],
    };

    await runCommand(parsed);
    const exitCode = await runCommand(parsed);

    expect(exitCode).toBe(0);
  });

  it('returns non-zero exit code for failing command', async () => {
    const srcFile = join(tempDir, 'test.ts');
    writeFileSync(srcFile, 'export const x = 1;');

    const exitCode = await runCommand({
      command: 'run',
      mode: 'glob',
      taskCommand: 'sh',
      glob: join(tempDir, '*.ts'),
      extraArgs: ['-c', 'exit 42'],
    });

    expect(exitCode).toBe(42);
  });

  it('returns 1 for nx mode (not yet implemented)', async () => {
    const exitCode = await runCommand({
      command: 'run',
      mode: 'nx',
      task: 'lint',
      project: 'mylib',
      extraArgs: [],
    });

    expect(exitCode).toBe(1);
  });
});
