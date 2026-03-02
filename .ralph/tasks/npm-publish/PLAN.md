# Plan: Publish dcache to npm under @neriros

## Summary

Bundle `apps/dcache` into a single self-contained npm package `@neriros/dcache` using esbuild. The bundler resolves all `@dcache/*` internal imports into one file, eliminating the need to publish internal libs separately or rewrite import specifiers.

## Approach: Single esbuild Bundle (Option A)

esbuild bundles `apps/dcache/src/main.ts` with all internal dependencies inlined. `fast-glob` is also bundled (no native deps, keeps zero runtime dependencies). The output is a single ESM file with a shebang banner.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Bundler | esbuild | Fast, handles ESM + top-level await, simple config |
| Bundle `fast-glob` | Yes | No native deps, eliminates runtime dependency |
| Output format | ESM (`format: esm`) | Matches project convention, supports top-level await |
| Package location | `apps/dcache/package.json` | Keeps it with the app; dist output goes to `dist/apps/dcache/` |
| Build integration | Nx target `bundle` in `project.json` | `dependsOn: ["^build"]` ensures libs type-check first |
| Publish target | Nx target `publish` | Copies package.json + README to dist, runs `npm publish` |
| Version | `0.1.0` | First publish, not yet stable |

### Architecture

```
apps/dcache/src/main.ts
        │ (esbuild --bundle)
        ▼
dist/apps/dcache/
├── bin/dcache.js          ← single bundled file with shebang
├── package.json           ← copied/generated for npm
└── README.md              ← basic usage docs
```

## Files to Create

| File | Purpose |
|---|---|
| `apps/dcache/package.json` | npm package manifest (`@neriros/dcache`) |
| `apps/dcache/README.md` | Basic README for the published package |
| `apps/dcache/esbuild.config.ts` | esbuild bundle configuration |

## Files to Modify

| File | Change |
|---|---|
| `apps/dcache/project.json` | Add `bundle` and `publish` targets |
| `package.json` (root) | Add `esbuild` to devDependencies |

## Risks & Open Questions

1. **Scope `@neriros`** — may not exist as an npm org. If publish fails, user can create the org or use `@nericoder` scope instead.
2. **npm auth** — token is expired. User must `npm login` before the publish step succeeds.
3. **Top-level await in esbuild** — supported with `format: esm`, but output must not be downleveled. Verify with a test run.
4. **`fast-glob` binary/native check** — research says pure JS; confirm no optional native deps get pulled in.
