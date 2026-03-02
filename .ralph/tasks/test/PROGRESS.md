# Progress: Demo Project for Manual Testing

## Section 1 — Scaffold the demo project

- [x] Add `"examples/*"` to `workspaces` array in root `package.json`
- [x] Create `examples/basic/package.json` with name `@dcache/example-basic`, scripts:
  - `dcache:run` → `bun run ../../apps/dcache/src/main.ts run`
  - `dcache:clear` → `bun run ../../apps/dcache/src/main.ts clear`
  - `dcache:help` → `bun run ../../apps/dcache/src/main.ts --help`
- [x] Create `examples/basic/dcache.config.json` with `{ "cacheDir": ".dcache" }`
- [x] Create `examples/basic/src/index.ts` — simple TypeScript file (e.g., exports a `greet` function)
- [x] Create `examples/basic/src/utils.ts` — second file (e.g., exports an `add` function)
- [x] Create `examples/basic/.gitignore` — ignore `.dcache/` and `node_modules/`
- [x] Create `examples/basic/README.md` — walkthrough of test scenarios (miss, hit, invalidate, clear)
- [x] Run `bun install` from repo root to register the new workspace

## Section 2 — Manual testing and verification

- [x] From `examples/basic/`, run `bun run dcache:help` — verify help output renders
- [x] From `examples/basic/`, run `bun run dcache:run -- "echo hello" --glob "src/**/*.ts"` — verify cache miss, task executes, `.dcache/` dir created with cache entry
- [x] Run same command again — verify cache hit, output replayed without re-executing
- [x] Modify `examples/basic/src/utils.ts` (e.g., add a comment), re-run — verify cache miss (invalidation)
- [x] Run `bun run dcache:clear` — verify `.dcache/` contents are cleared
- [x] If any issues found, fix and re-test — no issues found, all tests passed
- [x] Commit all new files — already committed in exec iteration 1 (06db1ce)
