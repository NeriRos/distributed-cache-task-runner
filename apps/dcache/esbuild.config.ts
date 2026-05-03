import { build } from 'esbuild';

await build({
  entryPoints: ['apps/dcache/src/main.ts'],
  outfile: 'dist/apps/dcache/bin/dcache.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire } from "module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
  alias: {
    '@dcache/cache': './libs/cache/src/index.ts',
    '@dcache/cli': './libs/cli/src/index.ts',
    '@dcache/config': './libs/config/src/index.ts',
    '@dcache/hasher': './libs/hasher/src/index.ts',
    '@dcache/nx-integration': './libs/nx-integration/src/index.ts',
    '@dcache/runner': './libs/runner/src/index.ts',
  },
  packages: 'external',
});
