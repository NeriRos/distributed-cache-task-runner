# Research: Publish dcache to npm under @neriros

## Task Summary

Publish `apps/dcache` to npm under the `@neriros` scope. If publishing an app directly is problematic, extract the publishable content into a lib and use the app as a thin shell.

---

## Current Architecture

### apps/dcache (the CLI binary)

**Files:** `apps/dcache/src/main.ts` (6 lines total)

```ts
#!/usr/bin/env node
import { main } from '@dcache/cli';
const exitCode = await main(process.argv.slice(2));
process.exitCode = exitCode;
```

- **No `package.json`** — only has `project.json` (Nx project config)
- Nx `projectType: "application"`, tags: `["scope:app"]`
- Build: `tsc -p apps/dcache/tsconfig.app.json --outDir dist/apps/dcache`
- Purely a shebang wrapper delegating to `@dcache/cli`

### libs/cli (the real CLI logic)

**Files:** `libs/cli/src/index.ts`, `libs/cli/src/commands/run.ts`, `libs/cli/src/commands/clear.ts`

- Exports `main(argv)` and `parseArgs(argv)` from `index.ts`
- `run.ts` imports from: `fast-glob`, `@dcache/config`, `@dcache/hasher`, `@dcache/cache`, `@dcache/runner`
- `clear.ts` imports from: `@dcache/config`, `@dcache/cache`

### Core libs dependency chain

```
cli → config, hasher, cache, runner
cache → config (via filesystem-provider)
hasher → (node builtins only)
config → (node builtins only)
runner → (node builtins only)
```

### External dependencies (runtime)

| Dependency | Used in | Type |
|---|---|---|
| `fast-glob` | `libs/cli/src/commands/run.ts` | Third-party (currently in root devDependencies) |
| `node:*` | Various | Node.js built-ins |

All other imports are internal `@dcache/*` packages or relative `.js` imports.

### nx-integration

`libs/nx-integration/src/index.ts` exports nothing (`export {}`). It's an empty stub, not used by any other code. Can be excluded from publishing.

---

## Build Output Analysis

### Problem: tsc output preserves monorepo structure

The current `tsc` build outputs to `dist/` but **preserves the full monorepo directory tree** and **does NOT rewrite `@dcache/*` import specifiers**.

**dist/apps/dcache/** structure:
```
dist/apps/dcache/
├── apps/dcache/src/main.js          # still imports '@dcache/cli'
└── libs/
    ├── cache/src/*.js
    ├── cli/src/*.js
    ├── config/src/*.js
    └── hasher/src/*.js
```

**dist/libs/cli/** structure:
```
dist/libs/cli/
├── package.json                     # main: "./src/index.ts" (WRONG for dist)
├── cache/src/*.js                   # all dependency sources compiled alongside
├── cli/src/*.js
├── config/src/*.js
├── hasher/src/*.js
└── runner/src/*.js
```

**Key issue:** Compiled JS still uses `import { logger } from '@dcache/config'` — bare specifiers are NOT rewritten to relative paths. The files exist in the dist tree, but they won't resolve at runtime unless there are actual `@dcache/*` packages installed.

### dist package.json (generated)

```json
{
  "name": "@dcache/cli",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",   // WRONG — points to .ts, should be .js
  "types": "./src/index.ts",  // WRONG — should be .d.ts
  "module": "./src/index.js"
}
```

---

## Publishing Strategy Options

### Option A: Bundle everything into a single package (Recommended)

Use a bundler (esbuild) to compile the entire dependency tree into a single self-contained package published as `@neriros/dcache`.

**Pros:**
- Single package to publish and maintain
- No need to publish internal libs separately
- Resolves the `@dcache/*` import rewriting problem automatically
- Users install one package: `npm i -g @neriros/dcache`

**Cons:**
- Need to add esbuild as a devDependency
- Need a new build target for the publishable bundle

**Implementation sketch:**
1. Add esbuild to devDependencies
2. Create a build script that bundles `apps/dcache/src/main.ts` → single JS file
3. Create a proper `package.json` for the published package (under `@neriros/dcache`)
4. Set `"bin": { "dcache": "./bin/dcache.js" }` in the published package.json

### Option B: Publish all libs separately under @neriros

Publish each `@dcache/*` lib as `@neriros/*` on npm, then publish the app.

**Pros:**
- Keeps modular structure
- Users can use individual libs

**Cons:**
- 5-6 packages to publish and version
- Need to rename all imports from `@dcache/*` to `@neriros/*` or add package aliasing
- Significantly more work, more maintenance
- Nobody will use the individual libs

### Option C: Create a publishable lib + thin app shell (task suggestion)

Move the publishable content into a new lib (e.g., `libs/dcache`), have the app re-export from it.

**Pros:**
- Follows the task's fallback suggestion
- Nx has good support for publishable libraries

**Cons:**
- Still needs to solve the `@dcache/*` import resolution problem
- Without bundling, you'd still need to publish all dependent libs

### Recommended: Option A (esbuild bundle)

A single bundled package is the cleanest approach. The entire project compiles to one file with no external dependencies except `fast-glob` (which can be bundled or kept as a dependency).

---

## Package Configuration Needed

### New/modified files for publishing

1. **`libs/dcache/package.json`** (or a publish-specific package.json) — the publishable package manifest:
   ```json
   {
     "name": "@neriros/dcache",
     "version": "1.0.0",
     "type": "module",
     "bin": { "dcache": "./bin/dcache.js" },
     "files": ["bin/", "dist/"],
     "engines": { "node": ">=18" }
   }
   ```

2. **Build config** — esbuild script or nx target to bundle:
   - Entry: `apps/dcache/src/main.ts`
   - Format: ESM
   - Platform: node
   - Bundle: true (inline all `@dcache/*` imports)
   - External: none (or keep `fast-glob` external if desired)
   - Banner: `#!/usr/bin/env node`

3. **Nx target** — add `publish` or `bundle` target to project.json

### npm Authentication

- Logged in as: `nericoder`
- Registry: `https://registry.npmjs.org/`
- **Access token is expired** — user will need to `npm login` before publishing
- `@neriros` scope: no packages found yet — scope may need to be created as an npm org or the user can publish under their username scope `@nericoder`

---

## Files to Modify/Create

| File | Action | Purpose |
|---|---|---|
| `apps/dcache/package.json` | Create | Publishable package manifest with bin, files, version |
| `apps/dcache/project.json` | Modify | Add `bundle` and `publish` targets |
| `root package.json` | Modify | Add `esbuild` to devDependencies |
| esbuild config or script | Create | Bundle entry point with all deps |

### Files NOT to modify

- All `libs/*/package.json` — keep as-is for monorepo development
- `libs/*/src/**` — no source changes needed
- `tsconfig.base.json` — keep path aliases for development

---

## Dependency Graph (build ordering)

```
1. Install esbuild (root devDep)
2. Build all libs (nx affected -t build) — needed for type checking
3. Bundle apps/dcache with esbuild → dist/apps/dcache/bin/dcache.js
4. Copy/generate package.json into dist
5. npm publish from dist directory
```

Steps 2 and 3 can be an Nx target with `dependsOn: ["^build"]`.

---

## Edge Cases & Risks

1. **`fast-glob` bundling**: If bundled, increases package size but removes runtime dep. If external, must be listed in package.json `dependencies`. Recommend: bundle it (it's small and has no native deps).

2. **Top-level await**: `apps/dcache/src/main.ts` uses `await` at top level. This works in ESM with Node >=14.8. esbuild supports this with `format: esm`.

3. **Shebang**: esbuild can add a shebang banner: `banner: { js: '#!/usr/bin/env node' }`.

4. **Scope availability**: `@neriros` may not exist as an npm org. User may need to create it or publish under `@nericoder`. Need to confirm with user.

5. **Version**: Currently `1.0.0-0` (prerelease). Should decide on `0.1.0` or `1.0.0` for first publish.

6. **No README**: Should create a basic README.md for the published package.
