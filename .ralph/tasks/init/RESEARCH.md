# Research: init — Distributed Cache Task Runner

## 1. Current State

The repository is **completely empty** — greenfield. Only infrastructure exists:
- `.claude/settings.local.json` — permissions config
- `.ralph/` — task runner infrastructure
- `.git/` — initialized, single commit (`c0b11bd add ralph`)

No `CLAUDE.md`, no source code, no `package.json`, no `nx.json`. Everything must be scaffolded from scratch.

## 2. Environment

| Tool | Version | Path |
|------|---------|------|
| bun | 1.3.8 | `/Users/personal/.bun/bin/bun` |
| node | v25.6.0 | nvm-managed |
| npx | 11.8.0 | nvm-managed |

Both bun and node are available. The task spec requires bun as the package manager.

## 3. Nx Workspace Setup — Approach Decision

### Option A: Traditional Integrated (`--preset=apps` or manual)
- Uses `libs/` and `apps/` directories
- `tsconfig.base.json` with `paths` aliases (`@dcache/*`)
- `project.json` per project with explicit build/test/lint targets
- This is what the **task spec describes**

### Option B: New Workspaces + Project References (`--preset=ts`)
- Uses `packages/` directory (configurable)
- Bun/npm workspaces with `package.json` per project
- TypeScript project references (`composite: true`)
- Each lib is a proper package with `exports` field
- Nx auto-infers tasks from `package.json` scripts
- **Current Nx recommendation** (v20+)

### Recommendation: Option A (Traditional Integrated)

The task spec is highly prescriptive about the structure — it specifies `libs/`, path aliases, `project.json` files, and specific executor references (`@nx/js:tsc`). Following the spec exactly avoids ambiguity. The traditional approach still works fine in current Nx.

**Setup command:**
```bash
bunx create-nx-workspace distributed-cache --preset=ts --pm=bun
```

Note: `--preset=ts` in current Nx actually generates the new workspaces-based setup. For the traditional integrated approach, we may need to:
1. Use `--preset=ts` and then restructure, OR
2. Manually scaffold the workspace

**Safest approach:** Manually scaffold or use `--preset=apps` and configure from there. We should verify during planning which preset gives us the closest starting point.

## 4. Library Generation

The `@nx/js:library` generator supports all options we need:

```bash
npx nx g @nx/js:lib libs/hasher \
  --bundler=tsc \
  --unitTestRunner=vitest \
  --tags="scope:core" \
  --importPath="@dcache/hasher"
```

Key generator options:
| Option | Value | Notes |
|--------|-------|-------|
| `--bundler` | `tsc` | Uses `@nx/js:tsc` executor |
| `--unitTestRunner` | `vitest` | Sets up vitest config |
| `--linter` | `eslint` | Default, uses `@nx/eslint` |
| `--tags` | `scope:core` etc. | For enforce-module-boundaries |
| `--importPath` | `@dcache/*` | TypeScript path alias |
| `--buildable` | `true` (default) | Creates build target |
| `--minimal` | `true` | Skip README generation |

## 5. Dependencies Analysis

### Production dependencies
| Package | Purpose | Notes |
|---------|---------|-------|
| `fast-glob` | File globbing | Used in hasher and nx-integration |

### Peer dependencies (for nx mode consumers)
| Package | Purpose |
|---------|---------|
| `@nx/devkit` | `createProjectGraphAsync()` |
| `nx` | Required by @nx/devkit |

### Dev dependencies (workspace-level)
| Package | Purpose |
|---------|---------|
| `@nx/js` | TypeScript library support |
| `@nx/vite` | Vitest integration |
| `@nx/eslint` | ESLint integration |
| `typescript` | Compiler |
| `vitest` | Test runner |
| `@types/node` | Node.js type definitions |

## 6. Module Boundary Rules

The enforce-module-boundaries ESLint rule requires:
1. Projects tagged with `scope:core`, `scope:cli`, `scope:app`
2. `depConstraints` array in ESLint config

```json
{
  "@nx/enforce-module-boundaries": ["error", {
    "depConstraints": [
      { "sourceTag": "scope:core", "onlyDependOnLibsWithTags": ["scope:core"] },
      { "sourceTag": "scope:cli", "onlyDependOnLibsWithTags": ["scope:core", "scope:cli"] },
      { "sourceTag": "scope:app", "onlyDependOnLibsWithTags": ["scope:cli", "scope:core", "scope:app"] }
    ]
  }]
}
```

This goes in the ESLint config (`.eslintrc.json` or `eslint.config.js`).

## 7. Architecture — Files to Create

### Directory tree (from task spec)

```
apps/
└── dcache/                       # scope:app
    ├── src/main.ts               # #!/usr/bin/env node → imports @dcache/cli
    ├── project.json
    └── tsconfig.json

libs/
├── cli/                          # scope:cli
│   ├── src/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── run.ts
│   │       └── clear.ts
│   ├── project.json
│   └── tsconfig.json
│
├── hasher/                       # scope:core
│   ├── src/
│   │   ├── index.ts
│   │   ├── file-hasher.ts
│   │   └── hasher.ts
│   ├── project.json
│   └── tsconfig.json
│
├── cache/                        # scope:core
│   ├── src/
│   │   ├── index.ts
│   │   ├── cache-provider.ts
│   │   └── filesystem-provider.ts
│   ├── project.json
│   └── tsconfig.json
│
├── nx-integration/               # scope:core
│   ├── src/
│   │   ├── index.ts
│   │   ├── project-graph.ts
│   │   ├── dependency-resolver.ts
│   │   └── file-collector.ts
│   ├── project.json
│   └── tsconfig.json
│
├── runner/                       # scope:core
│   ├── src/
│   │   ├── index.ts
│   │   └── task-runner.ts
│   ├── project.json
│   └── tsconfig.json
│
└── config/                       # scope:core
    ├── src/
    │   ├── index.ts
    │   ├── config.ts
    │   ├── logger.ts
    │   └── lock-file.ts
    ├── project.json
    └── tsconfig.json
```

### Root-level files needed
- `package.json` — workspace root
- `nx.json` — nx configuration, caching, task pipelines
- `tsconfig.base.json` — shared compiler options + path aliases
- `.eslintrc.json` or `eslint.config.js` — module boundary rules
- `.gitignore` — node_modules, dist, .cache, etc.
- `CLAUDE.md` — project conventions for agent

## 8. Internal Dependency Graph

```
apps/dcache → libs/cli
libs/cli → hasher, cache, nx-integration, runner, config
libs/nx-integration → config
libs/hasher → config
libs/cache → config
libs/runner → (standalone, no internal deps)
```

### Implementation ordering (parallelization opportunities)
1. **Phase 1 — Scaffolding** (sequential): workspace init, generate all libs
2. **Phase 2 — config** (first, no deps): logger, lock-file, config
3. **Phase 3 — hasher, cache, runner** (parallel, all depend only on config)
4. **Phase 4 — nx-integration** (depends on config)
5. **Phase 5 — cli** (depends on all core libs)
6. **Phase 6 — apps/dcache** (depends on cli)
7. **Phase 7 — tests** (after implementation)

## 9. Key Interfaces (from task spec)

### CacheProvider interface
```typescript
interface CacheEntry {
  hash: string;
  task: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  createdAt: string;
  durationMs: number;
}

interface CacheProvider {
  get(hash: string): Promise<CacheEntry | null>;
  set(hash: string, entry: CacheEntry): Promise<void>;
  has(hash: string): Promise<boolean>;
  clear(): Promise<void>;
}
```

### ParsedCommand type
```typescript
type ParsedCommand =
  | { command: 'run'; mode: 'glob'; taskCommand: string; glob: string; extraArgs: string[] }
  | { command: 'run'; mode: 'nx'; task: string; project: string; extraArgs: string[] }
  | { command: 'clear' }
  | { command: 'help' }
```

### Hashing strategy
- SHA-256 streaming per file
- Lexicographic sort of file paths for determinism
- Combined hash: `sha256(fileHash + lockFileHash + sha256(taskManifest))`
- Task manifest: deterministic JSON of `{ command, glob/project, args }`
- File contents only (no paths/timestamps) for portability

### Cache storage layout
```
node_modules/.cache/dcache/
  a1/a1b2c3d4e5...abc.json   # 2-char prefix subdirectory
```
Atomic writes via temp-file + rename.

## 10. Data Flow

### Glob mode
1. Parse args → command string + glob pattern
2. Glob files with `fast-glob`
3. Hash files + lock file + command → SHA-256
4. Check cache → hit: exit 0, miss: spawn command
5. Store result in cache, exit with task's code

### Nx mode
1. Parse args → task name + project name
2. `createProjectGraphAsync()` from `@nx/devkit`
3. BFS transitive dependency resolution
4. Glob source files from project + deps
5. Hash + cache check + run (same as glob mode)

## 11. Potential Issues / Edge Cases

1. **Nx preset mismatch**: `--preset=ts` may generate the new workspaces-based setup rather than the traditional `libs/` structure. May need manual scaffolding or `--preset=apps`.
2. **Bun + Nx compatibility**: bun 1.3.8 is well-supported by Nx. No known issues.
3. **ESM configuration**: `"type": "module"` in package.json requires ESM-compatible imports (file extensions or proper exports maps).
4. **`@nx/devkit` as peer dep**: The nx-integration lib should declare `@nx/devkit` and `nx` as peer dependencies, not direct dependencies, since consumers bring their own nx.
5. **Node.js crypto**: SHA-256 hashing uses `node:crypto` — built-in, no extra dep needed.
6. **Vitest config**: Each lib needs its own `vitest.config.ts` or the test target needs proper configuration.
7. **Binary entry point**: `apps/dcache/src/main.ts` needs shebang (`#!/usr/bin/env node`) and the built package needs a `bin` field in package.json.
8. **Atomic writes**: `filesystem-provider.ts` needs `fs.rename()` for atomic cache writes (write to temp file, then rename).

## 12. Verification Plan

| Check | Command | Expected |
|-------|---------|----------|
| Build | `nx build` or `nx run-many -t build` | Clean build, dist output |
| Test | `nx run-many -t test` | All unit tests pass |
| Lint | `nx run-many -t lint` | No errors, boundaries enforced |
| Type check | `nx run-many -t typecheck` | No type errors |
| Manual glob | `dcache run "echo hello" --glob "src/**"` (2x) | Second run cached |
| Cache invalidation | Modify file, re-run | Cache miss |
