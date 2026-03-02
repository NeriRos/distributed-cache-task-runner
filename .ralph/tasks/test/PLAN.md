# Plan: Demo Project for Manual Testing

## Summary

Create `examples/basic/` — a minimal project within the monorepo that exercises the dcache CLI end-to-end. Add it to bun workspaces so resolution works, include sample source files for glob-based hashing, and provide npm scripts that invoke dcache directly via `bun run ../../apps/dcache/src/main.ts`.

## Approach

**Invocation strategy: Option A** — relative path to `apps/dcache/src/main.ts` via `bun run`. This is the most reliable since bun resolves tsconfig path aliases natively. No build step needed, no bin resolution required.

**Cache dir: `.dcache/`** — use a `dcache.config.json` with `"cacheDir": ".dcache"` so cache contents are visible and inspectable (not buried in `node_modules/`). Add `.dcache/` to the example's `.gitignore`.

## Architectural Decisions

1. **Workspace membership** — add `"examples/*"` to root `package.json` workspaces so bun resolves the example as a workspace member. This is the lightest touch.
2. **No dependencies** — the example project doesn't need any npm dependencies; it just invokes dcache via a relative path. The workspace entry is only needed so `bun install` doesn't complain.
3. **Simple source files** — two `.ts` files (`src/index.ts`, `src/utils.ts`) with trivial content. The point is hashing, not the code itself.
4. **README with walkthrough** — step-by-step instructions for each test scenario (miss, hit, invalidation, clear).

## Files to Create

| File | Purpose |
|------|---------|
| `examples/basic/package.json` | Name, scripts (`dcache:run`, `dcache:clear`, `dcache:help`) |
| `examples/basic/dcache.config.json` | `cacheDir: ".dcache"` for visible cache |
| `examples/basic/src/index.ts` | Sample source file |
| `examples/basic/src/utils.ts` | Second source file |
| `examples/basic/.gitignore` | Ignore `.dcache/` |
| `examples/basic/README.md` | Manual testing walkthrough |

## Files to Modify

| File | Change |
|------|--------|
| `package.json` (root) | Add `"examples/*"` to `workspaces` |

## Risks / Open Questions

- **`findLockFile` walks up** — from `examples/basic/` it'll find the root `bun.lock`, which is fine for testing but means the hash includes the root lock file.
- **Nx awareness** — adding `examples/*` to workspaces may cause Nx to discover the example as a project. If it does, we may need an `nx.json` exclusion. Low risk — can address if it happens during testing.
