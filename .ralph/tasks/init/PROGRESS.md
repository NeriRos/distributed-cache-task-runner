# Progress: init — Distributed Cache Task Runner

## Section 1 — Workspace Scaffolding

- [ ] Create root `package.json` with `"name": "distributed-cache"`, `"type": "module"`, `"private": true`, bun workspaces config, and all dev dependencies (`nx`, `@nx/js`, `@nx/vite`, `@nx/eslint`, `typescript`, `vitest`, `@types/node`, `fast-glob`)
- [ ] Create `nx.json` with task pipelines (`build` depends on `^build`), default project settings, cacheable operations (`build`, `test`, `lint`, `typecheck`)
- [ ] Create `tsconfig.base.json` with shared compiler options (`target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `esModuleInterop: true`, `declaration: true`) and `paths` aliases for all six `@dcache/*` libraries
- [ ] Create `.eslintrc.json` with `@nx/enforce-module-boundaries` rule and `depConstraints` for `scope:core`, `scope:cli`, `scope:app`
- [ ] Create `.gitignore` (node_modules, dist, tmp, .cache, *.tsbuildinfo)
- [ ] Create `CLAUDE.md` with build/test/lint commands, project conventions, and module structure
- [ ] Run `bun install` to install all dependencies and verify no errors
- [ ] Verify `npx nx --version` works

## Section 2 — Generate Library Projects

- [ ] Generate `libs/config` via `npx nx g @nx/js:lib config --directory=libs/config --bundler=tsc --unitTestRunner=vitest --tags="scope:core" --importPath="@dcache/config" --minimal`
- [ ] Generate `libs/hasher` via same pattern with `--tags="scope:core" --importPath="@dcache/hasher"`
- [ ] Generate `libs/cache` via same pattern with `--tags="scope:core" --importPath="@dcache/cache"`
- [ ] Generate `libs/runner` via same pattern with `--tags="scope:core" --importPath="@dcache/runner"`
- [ ] Generate `libs/nx-integration` via same pattern with `--tags="scope:core" --importPath="@dcache/nx-integration"`
- [ ] Generate `libs/cli` via same pattern with `--tags="scope:cli" --importPath="@dcache/cli"`
- [ ] Create `apps/dcache/` directory structure manually: `project.json`, `tsconfig.json`, `src/main.ts` (shebang + imports `@dcache/cli`)
- [ ] Run `npx nx run-many -t build` to verify all generated projects build cleanly (expect mostly empty but no errors)

## Section 3 — libs/config Implementation

- [ ] Implement `libs/config/src/logger.ts` — leveled logger (`debug`, `info`, `warn`, `error`) writing to stderr, level controlled by `DCACHE_LOG_LEVEL` env var, default `info`
- [ ] Implement `libs/config/src/lock-file.ts` — `findLockFile(cwd: string): string | null` that checks for `bun.lockb`, `bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` in order
- [ ] Implement `libs/config/src/config.ts` — `loadConfig(cwd?: string): DcacheConfig` that reads optional `dcache.config.json`, merges with env vars (`DCACHE_CACHE_DIR`, `DCACHE_LOG_LEVEL`), applies defaults (cache dir: `node_modules/.cache/dcache`)
- [ ] Update `libs/config/src/index.ts` — re-export all public types and functions
- [ ] Write unit tests in `libs/config/src/*.spec.ts` — test logger output suppression at different levels, lock file detection with temp dirs, config defaults and override merging
- [ ] Verify: `npx nx test config` passes, `npx nx build config` produces dist output

## Section 4 — libs/hasher Implementation

- [ ] Implement `libs/hasher/src/file-hasher.ts` — `hashFile(filePath: string): Promise<string>` using `node:crypto` SHA-256 streaming, and `hashFiles(filePaths: string[]): Promise<string>` that sorts paths lexicographically, hashes each, then combines into single hash
- [ ] Implement `libs/hasher/src/hasher.ts` — `computeHash(opts: { files: string[]; lockFilePath?: string; taskManifest: Record<string, unknown> }): Promise<string>` that combines file hash + lock file hash + `sha256(JSON.stringify(taskManifest))` into final hash
- [ ] Update `libs/hasher/src/index.ts` — re-export `hashFile`, `hashFiles`, `computeHash`
- [ ] Write unit tests in `libs/hasher/src/*.spec.ts` — test deterministic output for same inputs, different output for different file contents, correct handling of missing lock file, task manifest ordering independence
- [ ] Verify: `npx nx test hasher` passes, `npx nx build hasher` succeeds

## Section 5 — libs/cache + libs/runner Implementation

- [ ] Implement `libs/cache/src/cache-provider.ts` — export `CacheEntry` interface and `CacheProvider` interface (get, set, has, clear)
- [ ] Implement `libs/cache/src/filesystem-provider.ts` — `FilesystemCacheProvider` class implementing `CacheProvider`: resolves cache dir from config, uses 2-char prefix subdirectories, atomic writes via `fs.mkdtemp` + `fs.rename`, JSON serialization
- [ ] Update `libs/cache/src/index.ts` — re-export types and `FilesystemCacheProvider`
- [ ] Write unit tests in `libs/cache/src/*.spec.ts` — test set/get/has/clear cycle, 2-char prefix path structure, missing entry returns null, clear removes all entries
- [ ] Implement `libs/runner/src/task-runner.ts` — `runTask(command: string, args?: string[]): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }>` using `node:child_process` spawn, captures stdout/stderr as strings, returns exit code and duration
- [ ] Update `libs/runner/src/index.ts` — re-export `runTask`
- [ ] Write unit tests in `libs/runner/src/*.spec.ts` — test successful command, failing command exit code, stdout/stderr capture
- [ ] Verify: `npx nx test cache` and `npx nx test runner` pass, builds succeed

## Section 6 — libs/nx-integration Implementation

- [ ] Implement `libs/nx-integration/src/project-graph.ts` — `getProjectGraph(): Promise<ProjectGraph>` wrapping `createProjectGraphAsync()` from `@nx/devkit`, with error handling for non-Nx workspaces
- [ ] Implement `libs/nx-integration/src/dependency-resolver.ts` — `resolveTransitiveDeps(graph: ProjectGraph, projectName: string): string[]` using BFS on the dependency graph, returns sorted list of all transitive dependency project names
- [ ] Implement `libs/nx-integration/src/file-collector.ts` — `collectProjectFiles(graph: ProjectGraph, projectNames: string[]): Promise<string[]>` that reads project root from graph nodes, globs `src/**` in each project root using `fast-glob`, returns sorted deduplicated file list
- [ ] Update `libs/nx-integration/src/index.ts` — re-export all public functions
- [ ] Write unit tests in `libs/nx-integration/src/*.spec.ts` — test BFS resolution with mock graph (linear chain, diamond deps), file collector with temp directory structure, error handling for missing projects
- [ ] Verify: `npx nx test nx-integration` passes, `npx nx build nx-integration` succeeds

## Section 7 — libs/cli + apps/dcache Implementation

- [ ] Implement `libs/cli/src/index.ts` — `main(argv: string[]): Promise<number>` entry point that parses args into `ParsedCommand`, dispatches to command handlers, returns exit code
- [ ] Implement `libs/cli/src/commands/run.ts` — `runCommand(parsed: ParsedCommand & { command: 'run' }): Promise<number>` orchestrating: resolve files (glob or nx mode) → compute hash → check cache → on miss: run task, store result → return exit code. On cache hit: log cached result, return 0
- [ ] Implement `libs/cli/src/commands/clear.ts` — `clearCommand(): Promise<number>` that creates `FilesystemCacheProvider` and calls `clear()`
- [ ] Update `libs/cli/src/index.ts` — re-export `main`
- [ ] Implement `apps/dcache/src/main.ts` — `#!/usr/bin/env node` shebang, imports `main` from `@dcache/cli`, calls `main(process.argv.slice(2))`, sets `process.exitCode`
- [ ] Update `apps/dcache/project.json` — add `bin` field configuration or build target that preserves shebang
- [ ] Write unit tests in `libs/cli/src/*.spec.ts` — test arg parsing for glob mode, nx mode, clear, help; test run command with mocked dependencies (cache hit path, cache miss path)
- [ ] Verify: `npx nx test cli` passes, `npx nx build dcache` produces working binary

## Section 8 — Integration Testing + Verification

- [ ] Run `npx nx run-many -t build` — all projects build without errors
- [ ] Run `npx nx run-many -t test` — all unit tests pass
- [ ] Run `npx nx run-many -t lint` — no lint errors, module boundary rules enforced
- [ ] Manual test glob mode: create a temp file, run `node dist/apps/dcache/main.js run "echo hello" --glob "*.ts"` twice, verify second run reports cache hit
- [ ] Manual test cache invalidation: modify the temp file, run again, verify cache miss
- [ ] Manual test clear: run `node dist/apps/dcache/main.js clear`, verify cache directory is cleaned
- [ ] Verify dependency graph: `npx nx graph --file=output.json` and confirm edges match expected dependency graph
