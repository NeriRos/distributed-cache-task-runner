import { spawn } from 'node:child_process';

export interface TaskResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function runTask(command: string, args: string[] = []): Promise<TaskResult> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', reject);

    child.on('close', (code) => {
      const durationMs = Math.round(performance.now() - start);
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        durationMs,
      });
    });
  });
}
