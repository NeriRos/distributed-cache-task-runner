export interface CacheEntry {
  hash: string;
  task: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  createdAt: string;
  durationMs: number;
  outputs: string[];
  hitCount?: number;
}

export interface CacheProvider {
  get(hash: string): Promise<CacheEntry | null>;
  set(hash: string, entry: CacheEntry): Promise<void>;
  has(hash: string): Promise<boolean>;
  clear(): Promise<void>;
  prune(now?: Date): Promise<number>;
  getArtifact(hash: string): Promise<Buffer | null>;
  setArtifact(hash: string, data: Buffer): Promise<void>;
}

export function isExpired(createdAt: string, ttlSeconds: number | undefined, now: Date): boolean {
  if (!ttlSeconds || ttlSeconds <= 0) return false;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  return now.getTime() - created > ttlSeconds * 1000;
}
