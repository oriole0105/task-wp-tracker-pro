import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@tt/shared/types': resolve(__dirname, '../shared/src/types/index.ts'),
      '@tt/shared/utils/taskHierarchy': resolve(__dirname, '../shared/src/utils/taskHierarchy.ts'),
      '@tt/shared/utils/taskDateUtils': resolve(__dirname, '../shared/src/utils/taskDateUtils.ts'),
    },
  },
});
