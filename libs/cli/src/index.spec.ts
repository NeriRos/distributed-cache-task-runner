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
      extraArgs: ['--verbose'],
    });
  });

  it('parses nx mode', () => {
    const result = parseArgs(['run', 'lint', '--project', 'mylib']);

    expect(result).toEqual({
      command: 'run',
      mode: 'nx',
      task: 'lint',
      project: 'mylib',
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
      extraArgs: ['--fix'],
    });
  });

  it('returns help for unknown command', () => {
    expect(parseArgs(['unknown'])).toEqual({ command: 'help' });
  });

  it('returns help when run has no --glob or --project', () => {
    expect(parseArgs(['run', 'lint'])).toEqual({ command: 'help' });
  });
});
