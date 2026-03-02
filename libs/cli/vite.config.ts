import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@dcache/config': resolve(root, 'libs/config/src/index.ts'),
      '@dcache/hasher': resolve(root, 'libs/hasher/src/index.ts'),
      '@dcache/cache': resolve(root, 'libs/cache/src/index.ts'),
      '@dcache/runner': resolve(root, 'libs/runner/src/index.ts'),
      '@dcache/nx-integration': resolve(root, 'libs/nx-integration/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    root: __dirname,
  },
});
