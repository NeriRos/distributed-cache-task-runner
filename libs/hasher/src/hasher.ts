import { createHash } from 'node:crypto';
import { hashFile, hashFiles } from './file-hasher.js';

export interface ComputeHashOptions {
  files: string[];
  lockFilePath?: string;
  taskManifest: Record<string, unknown>;
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function computeHash(opts: ComputeHashOptions): Promise<string> {
  const fileHash = await hashFiles(opts.files);

  const lockFileHash = opts.lockFilePath
    ? await hashFile(opts.lockFilePath)
    : '';

  const sortedManifest = JSON.stringify(opts.taskManifest, Object.keys(opts.taskManifest).sort());
  const manifestHash = sha256(sortedManifest);

  const combined = createHash('sha256');
  combined.update(fileHash);
  combined.update(lockFileHash);
  combined.update(manifestHash);
  return combined.digest('hex');
}
