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
    const parsed = JSON.parse(raw) as Partial<CacheEntry>;
    return { outputs: [], ...parsed } as CacheEntry;
  }

  async set(hash: string, entry: CacheEntry): Promise<void> {
    await mkdir(this.prefixDir(hash), { recursive: true });
    await this.atomicWrite(this.entryPath(hash), Buffer.from(JSON.stringify(entry, null, 2), 'utf-8'));
  }

  async has(hash: string): Promise<boolean> {
    return existsSync(this.entryPath(hash));
  }

  async clear(): Promise<void> {
    if (existsSync(this.cacheDir)) {
      await rm(this.cacheDir, { recursive: true, force: true });
    }
  }

  async getArtifact(hash: string): Promise<Buffer | null> {
    const filePath = this.artifactPath(hash);
    if (!existsSync(filePath)) return null;
    return readFile(filePath);
  }

  async setArtifact(hash: string, data: Buffer): Promise<void> {
    await mkdir(this.prefixDir(hash), { recursive: true });
    await this.atomicWrite(this.artifactPath(hash), data);
  }

  private async atomicWrite(targetPath: string, data: Buffer): Promise<void> {
    const tempDir = await mkdtemp(join(tmpdir(), 'dcache-write-'));
    const tempFile = join(tempDir, 'data');
    try {
      await writeFile(tempFile, data);
      await rename(tempFile, targetPath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private prefixDir(hash: string): string {
    return join(this.cacheDir, hash.slice(0, 2));
  }

  private entryPath(hash: string): string {
    return join(this.prefixDir(hash), `${hash}.json`);
  }

  private artifactPath(hash: string): string {
    return join(this.prefixDir(hash), `${hash}.tar.gz`);
  }
}
