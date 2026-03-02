# Distributed Cache Task Runner

## Quick Reference

```bash
# Build
nx affected -t build

# Test
nx affected -t test

# Lint
nx affected -t lint

# Typecheck
nx affected -t typecheck

# All checks
nx affected -t test,lint,typecheck

# Single project
nx run <project>:test
nx run <project>:build
```

## Project Structure

Nx monorepo with bun workspaces. ESM throughout (`"type": "module"`).

```
apps/dcache/          # Binary entry point (scope:app)
libs/config/          # Configuration + logger + lock-file detection (scope:core)
libs/hasher/          # File hashing (scope:core)
libs/cache/           # Cache storage (scope:core)
libs/runner/          # Task execution (scope:core)
libs/nx-integration/  # Nx project graph integration (scope:core)
libs/cli/             # CLI commands + arg parsing (scope:cli)
```

## Conventions

- **Module system:** ESM only (`"type": "module"`, `NodeNext` resolution)
- **TypeScript:** Strict mode, `ES2022` target
- **Testing:** Vitest
- **Package manager:** bun
- **Path aliases:** `@dcache/<lib>` mapped in `tsconfig.base.json`
- **Module boundaries:** Core libs cannot import CLI or app. CLI can import core. App can import anything.

## Module Boundary Rules

| Source Tag  | Can Depend On              |
|-------------|----------------------------|
| scope:core  | scope:core                 |
| scope:cli   | scope:core, scope:cli      |
| scope:app   | scope:cli, scope:core, scope:app |

## File Size Limits

- Max ~300 lines per file
- Max ~50 lines per function
- Extract helpers when approaching limits

## Important Notes

- Always use `nx affected` instead of `nx run-many` for CI/checks
- Never use `NX_DAEMON=false` — keep the daemon running
- Use Zod schemas at system boundaries, derive types with `z.infer<>`
