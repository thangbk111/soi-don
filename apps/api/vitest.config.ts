import { defineConfig } from 'vitest/config';

// Test *.int.test.ts cần Postgres → chạy riêng bằng `pnpm test:int`.
export default defineConfig({
  test: { exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.test.ts'] },
});
