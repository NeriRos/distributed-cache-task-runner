import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CacheEntry, CacheProvider } from './cache-provider.js';

export class FilesystemCacheProvider implements CacheProvider {
  private readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  async get(hash: string): Promise<CacheEntry | null> {
    const filePath = this.entryPath(hash);
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as CacheEntry;
  }

  async set(hash: string, entry: CacheEntry): Promise<void> {
    const filePath = this.entryPath(hash);
    const dir = this.prefixDir(hash);
    await mkdir(dir, { recursive: true });

    const tempDir = await mkdtemp(join(tmpdir(), 'dcache-write-'));
    const tempFile = join(tempDir, 'entry.json');
    await writeFile(tempFile, JSON.stringify(entry, null, 2), 'utf-8');
    await rename(tempFile, filePath);
    await rm(tempDir, { recursive: true, force: true });
  }

  async has(hash: string): Promise<boolean> {
    return existsSync(this.entryPath(hash));
  }

  async clear(): Promise<void> {
    if (existsSync(this.cacheDir)) {
      await rm(this.cacheDir, { recursive: true, force: true });
    }
  }

  private prefixDir(hash: string): string {
    return join(this.cacheDir, hash.slice(0, 2));
  }

  private entryPath(hash: string): string {
    return join(this.prefixDir(hash), `${hash}.json`);
  }
}
