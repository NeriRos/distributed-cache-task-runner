import { existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCK_FILES = [
  'bun.lockb',
  'bun.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
] as const;

export function findLockFile(cwd: string): string | null {
  for (const lockFile of LOCK_FILES) {
    const fullPath = join(cwd, lockFile);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}
