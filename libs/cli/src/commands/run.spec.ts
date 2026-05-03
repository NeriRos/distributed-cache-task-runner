import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
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
      outputs: [],
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
      outputs: [],
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
      outputs: [],
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
      outputs: [],
      extraArgs: [],
    });

    expect(exitCode).toBe(1);
  });

  it('captures and restores output files across runs', async () => {
    const srcFile = join(tempDir, 'src.ts');
    writeFileSync(srcFile, 'export const x = 1;');

    const distDir = join(tempDir, 'dist');
    const distFile = join(distDir, 'bundle.js');

    const parsed = {
      command: 'run' as const,
      mode: 'glob' as const,
      taskCommand: 'sh',
      glob: join(tempDir, 'src.ts'),
      outputs: ['dist'],
      extraArgs: ['-c', 'mkdir -p dist && echo built > dist/bundle.js'],
    };

    const first = await runCommand(parsed);
    expect(first).toBe(0);
    expect(readFileSync(distFile, 'utf-8').trim()).toBe('built');

    rmSync(distDir, { recursive: true, force: true });
    expect(existsSync(distFile)).toBe(false);

    const second = await runCommand(parsed);
    expect(second).toBe(0);
    expect(existsSync(distFile)).toBe(true);
    expect(readFileSync(distFile, 'utf-8').trim()).toBe('built');
  });

  it('does not store artifact when task fails', async () => {
    writeFileSync(join(tempDir, 'src.ts'), 'x');
    mkdirSync(join(tempDir, 'dist'), { recursive: true });
    writeFileSync(join(tempDir, 'dist', 'partial.js'), 'partial');

    const exitCode = await runCommand({
      command: 'run',
      mode: 'glob',
      taskCommand: 'sh',
      glob: join(tempDir, 'src.ts'),
      outputs: ['dist'],
      extraArgs: ['-c', 'exit 1'],
    });

    expect(exitCode).toBe(1);
    rmSync(join(tempDir, 'dist'), { recursive: true, force: true });

    const second = await runCommand({
      command: 'run',
      mode: 'glob',
      taskCommand: 'sh',
      glob: join(tempDir, 'src.ts'),
      outputs: ['dist'],
      extraArgs: ['-c', 'exit 1'],
    });
    expect(second).toBe(1);
    expect(existsSync(join(tempDir, 'dist'))).toBe(false);
  });
});
