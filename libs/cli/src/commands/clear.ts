import { loadConfig, logger } from '@dcache/config';
import { createCacheProvider } from '@dcache/cache';

export async function clearCommand(): Promise<number> {
  const config = loadConfig();
  const cache = await createCacheProvider(config.provider, config.cacheDir);
  await cache.clear();
  logger.info('Cache cleared');
  return 0;
}
