# Basic Example — dcache Manual Testing

This example project demonstrates `dcache` CLI usage with simple TypeScript source files.

## Setup

From the repo root:

```bash
bun install
```

## Test Scenarios

Run all commands from the `examples/basic/` directory.

### 1. Cache Miss (first run)

```bash
bun run dcache:run -- "echo hello" --glob "src/**/*.ts"
```

- The task executes and prints output.
- A `.dcache/` directory is created with a cache entry.

### 2. Cache Hit (repeat run)

```bash
bun run dcache:run -- "echo hello" --glob "src/**/*.ts"
```

- The cached output is replayed without re-executing the task.

### 3. Cache Invalidation (modify a source file)

Edit `src/utils.ts` (e.g., add a comment), then re-run:

```bash
bun run dcache:run -- "echo hello" --glob "src/**/*.ts"
```

- The file hash changes, so dcache detects a miss and re-executes.

### 4. Clear Cache

```bash
bun run dcache:clear
```

- The `.dcache/` directory contents are removed.

### 5. Help

```bash
bun run dcache:help
```

- Prints CLI usage information.
