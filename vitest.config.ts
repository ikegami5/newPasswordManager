import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@newpm/core': new URL('./packages/core/src/index.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/desktop/src/main/**/*.test.ts',
      'apps/android/src/domain/**/*.test.ts',
    ],
    environment: 'node',
  },
});
