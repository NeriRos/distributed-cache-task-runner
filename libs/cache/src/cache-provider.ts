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
  getArtifact(hash: string): Promise<Buffer | null>;
  setArtifact(hash: string, data: Buffer): Promise<void>;
}
