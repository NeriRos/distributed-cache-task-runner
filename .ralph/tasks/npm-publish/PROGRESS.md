# Progress: Publish dcache to npm

## Section 1 — Install esbuild and create bundle config

- [x] Add `esbuild` to root `package.json` devDependencies and run `bun install`
- [x] Create `apps/dcache/esbuild.config.ts` — esbuild script that bundles `apps/dcache/src/main.ts` to `dist/apps/dcache/bin/dcache.js` (ESM, platform node, bundle all deps, shebang banner)
- [x] Test the bundle by running the esbuild config directly — verify output file is created and contains no bare `@dcache/*` imports

## Section 2 — Package manifest, Nx targets, and README

- [x] Create `apps/dcache/package.json` with: `name: "@neriros/dcache"`, `version: "0.1.0"`, `type: "module"`, `bin: { "dcache": "./bin/dcache.js" }`, `files: ["bin/"]`, `engines: { "node": ">=18" }`
- [x] Modify `apps/dcache/project.json` — add `bundle` target (runs esbuild config, outputs to `dist/apps/dcache`, `dependsOn: ["^build"]`) and `publish` target (copies package.json + README to dist, runs `npm publish --access public` from `dist/apps/dcache`)
- [x] Create `apps/dcache/README.md` — brief description, install command (`npm i -g @neriros/dcache`), basic usage

## Section 3 — Integration test and verification

- [ ] Run `nx run dcache:bundle` — verify `dist/apps/dcache/bin/dcache.js` exists with shebang, is valid ESM, has no unresolved imports
- [ ] Run the bundled binary directly (`node dist/apps/dcache/bin/dcache.js --help`) — verify it works end-to-end
- [ ] Run `nx affected -t test,lint,typecheck` — verify no regressions in existing code
- [ ] Dry-run publish: `npm publish --dry-run` from `dist/apps/dcache/` — verify package contents look correct
