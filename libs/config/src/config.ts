import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { LogLevel } from './logger.js';

export interface DcacheConfig {
  cacheDir: string;
  logLevel: LogLevel;
}

interface ConfigFileSchema {
  cacheDir?: string;
  logLevel?: string;
}

const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function isValidLogLevel(value: string): value is LogLevel {
  return VALID_LOG_LEVELS.has(value);
}

function readConfigFile(cwd: string): ConfigFileSchema {
  const configPath = join(cwd, 'dcache.config.json');
  if (!existsSync(configPath)) {
    return {};
  }
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as ConfigFileSchema;
}

export function loadConfig(cwd?: string): DcacheConfig {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const fileConfig = readConfigFile(resolvedCwd);

  const envCacheDir = process.env['DCACHE_CACHE_DIR'];
  const envLogLevel = process.env['DCACHE_LOG_LEVEL']?.toLowerCase();

  const defaultCacheDir = join(resolvedCwd, 'node_modules', '.cache', 'dcache');

  const cacheDir = envCacheDir ?? fileConfig.cacheDir ?? defaultCacheDir;

  let logLevel: LogLevel = 'info';
  if (envLogLevel && isValidLogLevel(envLogLevel)) {
    logLevel = envLogLevel;
  } else if (fileConfig.logLevel && isValidLogLevel(fileConfig.logLevel)) {
    logLevel = fileConfig.logLevel as LogLevel;
  }

  return { cacheDir, logLevel };
}
