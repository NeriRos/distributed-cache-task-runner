import { loadConfig, logger } from '@dcache/config';
import { FilesystemCacheProvider } from '@dcache/cache';

export async function clearCommand(): Promise<number> {
  const config = loadConfig();
  const cache = new FilesystemCacheProvider(config.cacheDir);
  await cache.clear();
  logger.info('Cache cleared');
  return 0;
}
