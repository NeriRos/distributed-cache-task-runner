import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env['DCACHE_LOG_LEVEL'];

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    delete process.env['DCACHE_LOG_LEVEL'];
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (originalEnv !== undefined) {
      process.env['DCACHE_LOG_LEVEL'] = originalEnv;
    } else {
      delete process.env['DCACHE_LOG_LEVEL'];
    }
  });

  it('logs info, warn, error at default level (info)', () => {
    logger.info('hello');
    logger.warn('careful');
    logger.error('bad');

    expect(stderrSpy).toHaveBeenCalledTimes(3);
    expect(stderrSpy).toHaveBeenCalledWith('[dcache:info] hello\n');
    expect(stderrSpy).toHaveBeenCalledWith('[dcache:warn] careful\n');
    expect(stderrSpy).toHaveBeenCalledWith('[dcache:error] bad\n');
  });

  it('suppresses debug at default level (info)', () => {
    logger.debug('hidden');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('logs debug when level is debug', () => {
    process.env['DCACHE_LOG_LEVEL'] = 'debug';
    logger.debug('visible');
    expect(stderrSpy).toHaveBeenCalledWith('[dcache:debug] visible\n');
  });

  it('suppresses info and debug when level is warn', () => {
    process.env['DCACHE_LOG_LEVEL'] = 'warn';
    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('visible');
    logger.error('visible');
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it('only logs error when level is error', () => {
    process.env['DCACHE_LOG_LEVEL'] = 'error';
    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('hidden');
    logger.error('visible');
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).toHaveBeenCalledWith('[dcache:error] visible\n');
  });

  it('falls back to info for invalid DCACHE_LOG_LEVEL', () => {
    process.env['DCACHE_LOG_LEVEL'] = 'invalid';
    logger.debug('hidden');
    logger.info('visible');
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });
});
