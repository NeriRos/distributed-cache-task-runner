import { describe, it, expect } from 'vitest';
import { runTask } from './task-runner.js';

describe('runTask', () => {
  it('captures stdout from a successful command', async () => {
    const result = await runTask('echo', ['hello world']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures stderr output', async () => {
    const result = await runTask('sh', ['-c', 'echo error-output >&2']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe('error-output');
  });

  it('returns non-zero exit code for failing command', async () => {
    const result = await runTask('sh', ['-c', 'exit 42']);

    expect(result.exitCode).toBe(42);
  });

  it('captures both stdout and stderr', async () => {
    const result = await runTask('sh', ['-c', 'echo out; echo err >&2']);

    expect(result.stdout.trim()).toBe('out');
    expect(result.stderr.trim()).toBe('err');
  });

  it('rejects when command does not exist', async () => {
    await expect(runTask('nonexistent-command-xyz')).rejects.toThrow();
  });

  it('records duration in milliseconds', async () => {
    const result = await runTask('sh', ['-c', 'sleep 0.05']);

    expect(result.durationMs).toBeGreaterThanOrEqual(30);
  });
});
