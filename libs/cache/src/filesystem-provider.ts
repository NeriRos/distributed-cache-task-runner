import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isExpired, type CacheEntry, type CacheProvider } from './cache-provider.js';

export interface FilesystemCacheProviderOptions {
  cacheDir: string;
  ttlSeconds?: number;
}

export class FilesystemCacheProvider implements CacheProvider {
  private readonly cacheDir: string;
  private readonly ttlSeconds: number | undefined;

  constructor(options: FilesystemCacheProviderOptions | string) {
    if (typeof options === 'string') {
      this.cacheDir = options;
      this.ttlSeconds = undefined;
    } else {
      this.cacheDir = options.cacheDir;
      this.ttlSeconds = options.ttlSeconds;
    }
  }

  async get(hash: string): Promise<CacheEntry | null> {
    const filePath = this.entryPath(hash);
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CacheEntry>;
    const entry = { outputs: [], ...parsed } as CacheEntry;
    if (entry.createdAt && isExpired(entry.createdAt, this.ttlSeconds, new Date())) {
      await this.deleteEntry(hash);
      return null;
    }
    return entry;
  }

  async set(hash: string, entry: CacheEntry): Promise<void> {
    await mkdir(this.prefixDir(hash), { recursive: true });
    await this.atomicWrite(this.entryPath(hash), Buffer.from(JSON.stringify(entry, null, 2), 'utf-8'));
  }

  async has(hash: string): Promise<boolean> {
    if (!existsSync(this.entryPath(hash))) return false;
    if (!this.ttlSeconds) return true;
    return (await this.get(hash)) !== null;
  }

  async clear(): Promise<void> {
    if (existsSync(this.cacheDir)) {
      await rm(this.cacheDir, { recursive: true, force: true });
    }
  }

  async prune(now: Date = new Date()): Promise<number> {
    if (!this.ttlSeconds || !existsSync(this.cacheDir)) return 0;
    let evicted = 0;
    const prefixes = await readdir(this.cacheDir, { withFileTypes: true });
    for (const prefix of prefixes) {
      if (!prefix.isDirectory()) continue;
      const dir = join(this.cacheDir, prefix.name);
      const files = await readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const hash = file.slice(0, -5);
        try {
          const raw = await readFile(join(dir, file), 'utf-8');
          const parsed = JSON.parse(raw) as Partial<CacheEntry>;
          if (parsed.createdAt && isExpired(parsed.createdAt, this.ttlSeconds, now)) {
            await this.deleteEntry(hash);
            evicted++;
          }
        } catch {
          // skip unreadable/corrupt entry
        }
      }
    }
    return evicted;
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

  private async deleteEntry(hash: string): Promise<void> {
    await rm(this.entryPath(hash), { force: true });
    await rm(this.artifactPath(hash), { force: true });
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
