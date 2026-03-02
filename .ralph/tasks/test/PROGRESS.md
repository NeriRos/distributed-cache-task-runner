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

- [ ] From `examples/basic/`, run `bun run dcache:help` — verify help output renders
- [ ] From `examples/basic/`, run `bun run dcache:run -- "echo hello" --glob "src/**/*.ts"` — verify cache miss, task executes, `.dcache/` dir created with cache entry
- [ ] Run same command again — verify cache hit, output replayed without re-executing
- [ ] Modify `examples/basic/src/utils.ts` (e.g., add a comment), re-run — verify cache miss (invalidation)
- [ ] Run `bun run dcache:clear` — verify `.dcache/` contents are cleared
- [ ] If any issues found, fix and re-test
- [ ] Commit all new files: `git add examples/ package.json bun.lock && git commit -m "feat: add basic example for manual CLI testing"`
