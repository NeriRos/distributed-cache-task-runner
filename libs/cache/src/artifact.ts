import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface PackOptions {
  cwd: string;
  paths: string[];
}

export interface ExtractOptions {
  cwd: string;
  data: Buffer;
}

export async function packArtifact({ cwd, paths }: PackOptions): Promise<Buffer | null> {
  const existing = paths.filter((p) => existsSync(join(cwd, p)));
  if (existing.length === 0) return null;

  const tempDir = await mkdtemp(join(tmpdir(), 'dcache-pack-'));
  const archivePath = join(tempDir, 'artifact.tar.gz');
  try {
    await runTar(['-czf', archivePath, ...existing], cwd);
    return await readFile(archivePath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function extractArtifact({ cwd, data }: ExtractOptions): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'dcache-extract-'));
  const archivePath = join(tempDir, 'artifact.tar.gz');
  try {
    await writeFile(archivePath, data);
    await runTar(['-xzf', archivePath], cwd);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runTar(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    const stderrChunks: Buffer[] = [];
    child.stderr.on('data', (c: Buffer) => stderrChunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      reject(new Error(`tar ${args[0]} failed (code ${code}): ${stderr.trim()}`));
    });
  });
}
