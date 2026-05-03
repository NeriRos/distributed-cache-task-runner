import type { CacheProvider } from './cache-provider.js';

export type ProviderConfig =
  | { type: 'filesystem'; cacheDir?: string; ttlSeconds?: number }
  | { type: 'postgresql'; connectionString: string; table?: string; ttlSeconds?: number };
import { FilesystemCacheProvider } from './filesystem-provider.js';
import { PostgresqlCacheProvider } from './postgresql-provider.js';

export async function createCacheProvider(
  provider: ProviderConfig,
  fallbackCacheDir: string,
): Promise<CacheProvider> {
  if (provider.type === 'filesystem') {
    return new FilesystemCacheProvider({
      cacheDir: provider.cacheDir ?? fallbackCacheDir,
      ttlSeconds: provider.ttlSeconds,
    });
  }

  const pgModule = await import('pg').catch(() => {
    throw new Error(
      "PostgreSQL provider requires the 'pg' package. Install it with: bun add pg",
    );
  });
  const PgPool = (pgModule as { default?: { Pool: new (opts: unknown) => unknown }; Pool?: new (opts: unknown) => unknown })
    .Pool ?? (pgModule as { default: { Pool: new (opts: unknown) => unknown } }).default.Pool;

  const pool = new PgPool({ connectionString: provider.connectionString }) as ConstructorParameters<
    typeof PostgresqlCacheProvider
  >[0]['pool'];

  return new PostgresqlCacheProvider({ pool, table: provider.table, ttlSeconds: provider.ttlSeconds });
}
