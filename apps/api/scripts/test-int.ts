/**
 * Chạy integration test trên schema Postgres riêng `it_test` (cùng server với DATABASE_URL),
 * không đụng dữ liệu dev. Usage: pnpm --filter @soi-don/api test:int
 */
import { execSync } from 'node:child_process';

const base = process.env.DATABASE_URL;
if (!base) throw new Error('DATABASE_URL is not set');
const url = new URL(base);
url.searchParams.set('schema', 'it_test');
const env = { ...process.env, DATABASE_URL: url.toString() };

execSync('pnpm --filter @soi-don/db exec prisma migrate deploy', { stdio: 'inherit', env });
execSync('pnpm exec vitest run --config vitest.int.config.ts', { stdio: 'inherit', env });
