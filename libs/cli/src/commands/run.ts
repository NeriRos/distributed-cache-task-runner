import fg from 'fast-glob';
import { loadConfig, findLockFile, logger } from '@dcache/config';
import { computeHash } from '@dcache/hasher';
import { FilesystemCacheProvider } from '@dcache/cache';
import { runTask } from '@dcache/runner';
import { getProjectFiles } from '@dcache/nx-integration';
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
  return { cmd: parsed.task, args: parsed.extraArgs };
}

export async function runCommand(parsed: RunParsed): Promise<number> {
  const config = loadConfig();
  const lockFilePath = findLockFile(process.cwd()) ?? undefined;
  const cache = new FilesystemCacheProvider(config.cacheDir);

  const files = await resolveFiles(parsed);
  if (parsed.mode === 'nx' && files.length === 0) {
    return 1;
  }

  const taskManifest = buildTaskManifest(parsed);
  const hash = await computeHash({ files, lockFilePath, taskManifest });

  logger.debug(`Computed hash: ${hash}`);

  const cached = await cache.get(hash);
  if (cached) {
    logger.info('Cache hit — skipping task execution');
    if (cached.stdout) process.stdout.write(cached.stdout);
    if (cached.stderr) process.stderr.write(cached.stderr);
    return cached.exitCode;
  }

  logger.info('Cache miss — running task');
  const { cmd, args } = parseCommand(parsed);
  const result = await runTask(cmd, args);

  await cache.set(hash, {
    hash,
    task: parsed.mode === 'glob' ? parsed.taskCommand : parsed.task,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    createdAt: new Date().toISOString(),
    durationMs: result.durationMs,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result.exitCode;
}
