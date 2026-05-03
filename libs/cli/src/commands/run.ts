import { spawn } from 'node:child_process';
import { relative, isAbsolute, resolve as resolvePath } from 'node:path';
import fg from 'fast-glob';
import { loadConfig, findLockFile, logger } from '@dcache/config';
import { computeHash } from '@dcache/hasher';
import { createCacheProvider, packArtifact, extractArtifact, type CacheProvider, type CacheEntry } from '@dcache/cache';
import { runTask } from '@dcache/runner';
import { getProjectFiles, getProjectOutputs } from '@dcache/nx-integration';
import type { ParsedCommand } from '../index.js';

type RunParsed = ParsedCommand & { command: 'run' };

function gitTrackedFiles(cwd: string): Promise<Set<string> | null> {
  return new Promise((resolveFn) => {
    const child = spawn('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.on('error', () => resolveFn(null));
    child.on('close', (code) => {
      if (code !== 0) {
        resolveFn(null);
        return;
      }
      const set = new Set<string>();
      for (const rel of Buffer.concat(chunks).toString('utf-8').split('\0')) {
        if (rel) set.add(resolvePath(cwd, rel));
      }
      resolveFn(set);
    });
  });
}

async function resolveFiles(
  parsed: RunParsed,
  ignore: string[],
  respectGitignore: boolean,
  cwd: string,
): Promise<string[]> {
  if (parsed.mode === 'glob') {
    const files = await fg(parsed.glob, { absolute: true, dot: false, ignore });
    if (respectGitignore) {
      const tracked = await gitTrackedFiles(cwd);
      if (!tracked) {
        logger.warn('respectGitignore is enabled but `git ls-files` failed — keeping all matched files');
      } else {
        const filtered = files.filter((f) => tracked.has(f));
        if (filtered.length === 0 && files.length > 0) {
          logger.warn('respectGitignore filtered out every matched file');
        }
        if (filtered.length === 0) {
          logger.warn(`No files matched glob pattern: ${parsed.glob}`);
        }
        return filtered;
      }
    }
    if (files.length === 0) {
      logger.warn(`No files matched glob pattern: ${parsed.glob}`);
    }
    return files;
  }

  try {
    const { files, projectRoot } = await getProjectFiles(parsed.project);
    if (files.length === 0) {
      logger.warn(`Nx project "${parsed.project}" has no source files (root: ${projectRoot})`);
    }
    return files;
  } catch (err) {
    logger.error((err as Error).message);
    return [];
  }
}

async function resolveOutputs(parsed: RunParsed): Promise<string[]> {
  const explicit = parsed.outputs;
  if (explicit.length > 0) return explicit;
  if (parsed.mode === 'nx') {
    try {
      return await getProjectOutputs(parsed.project, parsed.task);
    } catch {
      return [];
    }
  }
  return [];
}

function buildTaskManifest(
  parsed: RunParsed,
  ignore: string[],
  respectGitignore: boolean,
): Record<string, unknown> {
  if (parsed.mode === 'glob') {
    return {
      command: parsed.taskCommand,
      glob: parsed.glob,
      ignore: [...ignore].sort(),
      respectGitignore,
      extraArgs: parsed.extraArgs,
    };
  }
  return {
    task: parsed.task,
    project: parsed.project,
    extraArgs: parsed.extraArgs,
  };
}

function parseCommand(parsed: RunParsed): { cmd: string; args: string[] } {
  if (parsed.mode === 'glob') {
    const parts = parsed.taskCommand.split(/\s+/);
    return { cmd: parts[0], args: [...parts.slice(1), ...parsed.extraArgs] };
  }
  return { cmd: 'nx', args: ['run', `${parsed.project}:${parsed.task}`, ...parsed.extraArgs] };
}

function toRelative(cwd: string, path: string): string {
  return isAbsolute(path) ? relative(cwd, path) : path;
}

async function restoreOutputs(cache: CacheProvider, entry: CacheEntry, cwd: string): Promise<void> {
  if (entry.outputs.length === 0) return;
  const data = await cache.getArtifact(entry.hash);
  if (!data) {
    logger.warn(`Cache entry has outputs but no artifact stored (hash: ${entry.hash})`);
    return;
  }
  await extractArtifact({ cwd, data });
  logger.info(`Restored ${entry.outputs.length} output path(s)`);
}

async function captureOutputs(
  cache: CacheProvider,
  hash: string,
  outputs: string[],
  cwd: string,
): Promise<string[]> {
  if (outputs.length === 0) return [];
  const relPaths = outputs.map((o) => toRelative(cwd, o));
  const data = await packArtifact({ cwd, paths: relPaths });
  if (!data) {
    logger.warn('No output paths existed after task ran — skipping artifact storage');
    return [];
  }
  await cache.setArtifact(hash, data);
  logger.info(`Stored ${relPaths.length} output path(s) (${data.byteLength} bytes)`);
  return relPaths;
}

export async function runCommand(parsed: RunParsed): Promise<number> {
  const config = loadConfig();
  const cwd = process.cwd();
  const lockFilePath = findLockFile(cwd) ?? undefined;
  const cache = await createCacheProvider(config.provider, config.cacheDir);

  const ignore = parsed.mode === 'glob' ? [...config.ignore, ...parsed.ignore] : [];
  const files = await resolveFiles(parsed, ignore, config.respectGitignore, cwd);
  if (parsed.mode === 'nx' && files.length === 0) {
    return 1;
  }

  const outputs = await resolveOutputs(parsed);
  const taskManifest = buildTaskManifest(parsed, ignore, config.respectGitignore);
  const hash = await computeHash({ files, lockFilePath, taskManifest });

  logger.debug(`Computed hash: ${hash}`);

  const cached = await cache.get(hash);
  if (cached) {
    logger.info('Cache hit — skipping task execution');
    const cacheStart = performance.now();
    await restoreOutputs(cache, cached, cwd);
    if (cached.stdout) process.stdout.write(cached.stdout);
    if (cached.stderr) process.stderr.write(cached.stderr);
    const cacheRestoreMs = Math.round(performance.now() - cacheStart);

    const nextHitCount = (cached.hitCount ?? 0) + 1;
    const interval = config.benchmarkInterval;
    const shouldBenchmark = interval > 0 && (nextHitCount === 1 || nextHitCount % interval === 0);

    let directDurationMs = cached.durationMs;
    if (shouldBenchmark) {
      const { cmd, args } = parseCommand(parsed);
      const benchmark = await runTask(cmd, args);
      directDurationMs = benchmark.durationMs;
      logger.debug(`Benchmark: cache=${cacheRestoreMs}ms direct=${directDurationMs}ms`);
      if (cacheRestoreMs > directDurationMs * 1.2) {
        const taskName = parsed.mode === 'glob' ? parsed.taskCommand : `${parsed.project}:${parsed.task}`;
        logger.warn(
          `Cache overhead (${cacheRestoreMs}ms) exceeds direct execution (${directDurationMs}ms) for "${taskName}" — caching may be hurting; consider running the command directly`,
        );
      }
    }

    await cache.set(hash, { ...cached, hitCount: nextHitCount, durationMs: directDurationMs });
    return cached.exitCode;
  }

  logger.info('Cache miss — running task');
  const { cmd, args } = parseCommand(parsed);
  const result = await runTask(cmd, args);

  const storedOutputs = result.exitCode === 0 ? await captureOutputs(cache, hash, outputs, cwd) : [];

  await cache.set(hash, {
    hash,
    task: parsed.mode === 'glob' ? parsed.taskCommand : parsed.task,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    createdAt: new Date().toISOString(),
    durationMs: result.durationMs,
    outputs: storedOutputs,
    hitCount: 0,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result.exitCode;
}
