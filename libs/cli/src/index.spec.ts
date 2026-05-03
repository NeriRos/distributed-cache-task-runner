import { describe, it, expect } from 'vitest';
import { parseArgs } from './index.js';

describe('parseArgs', () => {
  it('returns help when no args', () => {
    expect(parseArgs([])).toEqual({ command: 'help' });
  });

  it('returns help for --help flag', () => {
    expect(parseArgs(['--help'])).toEqual({ command: 'help' });
  });

  it('returns help for -h flag', () => {
    expect(parseArgs(['-h'])).toEqual({ command: 'help' });
  });

  it('parses clear command', () => {
    expect(parseArgs(['clear'])).toEqual({ command: 'clear' });
  });

  it('parses glob mode', () => {
    const result = parseArgs(['run', 'nx', 'lint', 'mylib', '--glob', 'libs/mylib/src/**']);

    expect(result).toEqual({
      command: 'run',
      mode: 'glob',
      taskCommand: 'nx lint mylib',
      glob: 'libs/mylib/src/**',
      ignore: [],
      outputs: [],
      extraArgs: [],
    });
  });

  it('parses glob mode with extra args', () => {
    const result = parseArgs(['run', 'echo', 'hello', '--glob', '*.ts', '--verbose']);

    expect(result).toEqual({
      command: 'run',
      mode: 'glob',
      taskCommand: 'echo hello',
      glob: '*.ts',
      ignore: [],
      outputs: [],
      extraArgs: ['--verbose'],
    });
  });

  it('collects --ignore flags (repeatable, glob mode)', () => {
    const result = parseArgs([
      'run',
      'tsc',
      '--glob',
      '**/*.ts',
      '--ignore',
      '**/dist/**',
      '--ignore',
      '**/.vercel/**',
    ]);

    expect(result).toEqual({
      command: 'run',
      mode: 'glob',
      taskCommand: 'tsc',
      glob: '**/*.ts',
      ignore: ['**/dist/**', '**/.vercel/**'],
      outputs: [],
      extraArgs: [],
    });
  });

  it('parses nx mode', () => {
    const result = parseArgs(['run', 'lint', '--project', 'mylib']);

    expect(result).toEqual({
      command: 'run',
      mode: 'nx',
      task: 'lint',
      project: 'mylib',
      outputs: [],
      extraArgs: [],
    });
  });

  it('parses nx mode with extra args', () => {
    const result = parseArgs(['run', 'typecheck', '--project', 'shared', '--fix']);

    expect(result).toEqual({
      command: 'run',
      mode: 'nx',
      task: 'typecheck',
      project: 'shared',
      outputs: [],
      extraArgs: ['--fix'],
    });
  });

  it('collects --output flags (repeatable)', () => {
    const result = parseArgs([
      'run',
      'build',
      '--project',
      'mylib',
      '--output',
      'dist',
      '--output',
      'build/types',
    ]);

    expect(result).toEqual({
      command: 'run',
      mode: 'nx',
      task: 'build',
      project: 'mylib',
      outputs: ['dist', 'build/types'],
      extraArgs: [],
    });
  });

  it('--output works in glob mode too', () => {
    const result = parseArgs(['run', 'tsc', '--glob', '*.ts', '--output', 'dist']);

    expect(result).toEqual({
      command: 'run',
      mode: 'glob',
      taskCommand: 'tsc',
      glob: '*.ts',
      ignore: [],
      outputs: ['dist'],
      extraArgs: [],
    });
  });

  it('returns help for unknown command', () => {
    expect(parseArgs(['unknown'])).toEqual({ command: 'help' });
  });

  it('returns help when run has no --glob or --project', () => {
    expect(parseArgs(['run', 'lint'])).toEqual({ command: 'help' });
  });
});
