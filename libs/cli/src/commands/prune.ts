import { loadConfig, logger } from '@dcache/config';
import { createCacheProvider } from '@dcache/cache';

export async function pruneCommand(): Promise<number> {
  const config = loadConfig();
  const cache = await createCacheProvider(config.provider, config.cacheDir);
  const evicted = await cache.prune();
  logger.info(`Pruned ${evicted} expired ${evicted === 1 ? 'entry' : 'entries'}`);
  return 0;
}
