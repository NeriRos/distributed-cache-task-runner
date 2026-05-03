# @neriros/dcache

A distributed task cache for shell commands and Nx tasks. Hashes your source files and the lockfile, then replays the cached stdout/stderr/exit code on a hit so the task never runs twice for the same inputs.

## Install

```bash
npm i -g @neriros/dcache
# or
bun add -g @neriros/dcache
```

Requires Node.js >= 18.

## Usage

### Glob mode — cache any shell command

Hash the files matched by `--glob` (plus the detected lockfile and the command itself). On a hit, the original stdout/stderr/exit code are replayed:

```bash
dcache run "tsc --noEmit" --glob "src/**/*.ts"
dcache run "eslint ." --glob "src/**/*.{ts,tsx}"
```

### Nx mode

```bash
dcache run build --project my-app
```

> Nx mode is wired into the CLI but the project-graph integration is still landing — prefer glob mode today.

### Clear the cache

```bash
dcache clear
```

### Help

```bash
dcache --help
```

## How it works

1. Resolve the input files (glob or Nx project graph).
2. Compute a content hash over: each file, the detected lockfile (`bun.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), and a manifest of the task itself (command + args).
3. Look the hash up in the cache.
   - **Hit:** replay the stored stdout/stderr and exit with the stored code.
   - **Miss:** run the task, stream output, and store the result.

Because the hash includes the lockfile, dependency upgrades automatically invalidate stale entries.

## Configuration

Resolved in this order (first wins):

| Source | Keys |
|---|---|
| Environment | `DCACHE_CACHE_DIR`, `DCACHE_LOG_LEVEL` |
| `dcache.config.json` (in cwd) | `cacheDir`, `logLevel` |
| Defaults | `cacheDir = node_modules/.cache/dcache`, `logLevel = info` |

`logLevel` accepts `debug`, `info`, `warn`, `error`.

Example `dcache.config.json`:

```json
{
  "cacheDir": ".dcache",
  "logLevel": "debug"
}
```

## Cache backends

- **Filesystem** (default) — writes JSON entries under the configured `cacheDir`.
- **PostgreSQL** — `PostgresqlCacheProvider` is shipped for shared/distributed use across machines and CI runners. CLI wiring for remote backends is on the roadmap; the provider is consumable today via the library API.

## License

MIT
