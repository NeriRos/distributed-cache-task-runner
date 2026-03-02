# Progress: init — Distributed Cache Task Runner

## Section 1 — Workspace Scaffolding

- [x] Create root `package.json` with `"name": "distributed-cache"`, `"type": "module"`, `"private": true`, bun workspaces config, and all dev dependencies (`nx`, `@nx/js`, `@nx/vite`, `@nx/eslint`, `typescript`, `vitest`, `@types/node`, `fast-glob`)
- [x] Create `nx.json` with task pipelines (`build` depends on `^build`), default project settings, cacheable operations (`build`, `test`, `lint`, `typecheck`)
- [x] Create `tsconfig.base.json` with shared compiler options (`target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `esModuleInterop: true`, `declaration: true`) and `paths` aliases for all six `@dcache/*` libraries
- [x] Create `.eslintrc.json` with `@nx/enforce-module-boundaries` rule and `depConstraints` for `scope:core`, `scope:cli`, `scope:app`
- [x] Create `.gitignore` (node_modules, dist, tmp, .cache, *.tsbuildinfo)
- [x] Create `CLAUDE.md` with build/test/lint commands, project conventions, and module structure
- [x] Run `bun install` to install all dependencies and verify no errors
- [x] Verify `npx nx --version` works

## Section 2 — Generate Library Projects

- [x] Generate `libs/config` — created manually (Nx generator conflicted with pre-existing path aliases). Includes project.json, tsconfig files, vite.config.ts, package.json, .eslintrc.json, src/index.ts
- [x] Generate `libs/hasher` — same structure with `scope:core` tag
- [x] Generate `libs/cache` — same structure with `scope:core` tag
- [x] Generate `libs/runner` — same structure with `scope:core` tag
- [x] Generate `libs/nx-integration` — same structure with `scope:core` tag
- [x] Generate `libs/cli` — same structure with `scope:cli` tag
- [x] Create `apps/dcache/` directory structure — project.json, tsconfig.json, tsconfig.app.json, package.json, .eslintrc.json, src/main.ts (shebang + placeholder for @dcache/cli import)
- [x] Verify all projects build cleanly — `nx affected -t test,lint,typecheck,build` passes for all 7 projects (27 tasks). Fixed: added @nx/eslint-plugin, @typescript-eslint/parser, eslint@8 as dev deps; configured TS parser in root .eslintrc.json

## Section 3 — libs/config Implementation

- [x] Implement `libs/config/src/logger.ts` — leveled logger (`debug`, `info`, `warn`, `error`) writing to stderr, level controlled by `DCACHE_LOG_LEVEL` env var, default `info`
- [x] Implement `libs/config/src/lock-file.ts` — `findLockFile(cwd: string): string | null` that checks for `bun.lockb`, `bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` in order
- [x] Implement `libs/config/src/config.ts` — `loadConfig(cwd?: string): DcacheConfig` that reads optional `dcache.config.json`, merges with env vars (`DCACHE_CACHE_DIR`, `DCACHE_LOG_LEVEL`), applies defaults (cache dir: `node_modules/.cache/dcache`)
- [x] Update `libs/config/src/index.ts` — re-export all public types and functions
- [x] Write unit tests in `libs/config/src/*.spec.ts` — 21 tests across 3 files: logger level suppression, lock file detection with temp dirs, config defaults and override merging
- [x] Verify: `nx affected -t test,lint,typecheck` passes, `nx run config:build` produces dist output. Also fixed vite.config.ts root path so tests are discoverable.

## Section 4 — libs/hasher Implementation

- [x] Implement `libs/hasher/src/file-hasher.ts` — `hashFile` (streaming SHA-256) and `hashFiles` (sorts paths, hashes each, combines)
- [x] Implement `libs/hasher/src/hasher.ts` — `computeHash` combining file hash + lock file hash + sorted manifest hash
- [x] Update `libs/hasher/src/index.ts` — re-exports `hashFile`, `hashFiles`, `computeHash`, `ComputeHashOptions`
- [x] Write unit tests in `libs/hasher/src/*.spec.ts` — 14 tests covering determinism, different content, missing files, lock file inclusion, manifest ordering independence
- [x] Verify: `nx affected -t test,lint,typecheck` passes, `nx build hasher` succeeds. Also fixed `vite.config.ts` to include `root: __dirname` for test discovery.

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
