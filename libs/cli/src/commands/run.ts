import { relative, isAbsolute } from 'node:path';
import fg from 'fast-glob';
import { loadConfig, findLockFile, logger } from '@dcache/config';
import { computeHash } from '@dcache/hasher';
import { createCacheProvider, packArtifact, extractArtifact, type CacheProvider, type CacheEntry } from '@dcache/cache';
import { runTask } from '@dcache/runner';
import { getProjectFiles, getProjectOutputs } from '@dcache/nx-integration';
import type { ParsedCommand } from '../index.js';

type RunParsed = ParsedCommand & { command: 'run' };

async function resolveFiles(parsed: RunParsed): Promise<string[]> {
  if (parsed.mode === 'glob') {
    const files = await fg(parsed.glob, { absolute: true, dot: false });
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

function buildTaskManifest(parsed: RunParsed): Record<string, unknown> {
  if (parsed.mode === 'glob') {
    return {
      command: parsed.taskCommand,
      glob: parsed.glob,
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

  const files = await resolveFiles(parsed);
  if (parsed.mode === 'nx' && files.length === 0) {
    return 1;
  }

  const outputs = await resolveOutputs(parsed);
  const taskManifest = buildTaskManifest(parsed);
  const hash = await computeHash({ files, lockFilePath, taskManifest });

  logger.debug(`Computed hash: ${hash}`);

  const cached = await cache.get(hash);
  if (cached) {
    logger.info('Cache hit — skipping task execution');
    await restoreOutputs(cache, cached, cwd);
    if (cached.stdout) process.stdout.write(cached.stdout);
    if (cached.stderr) process.stderr.write(cached.stderr);
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
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result.exitCode;
}
