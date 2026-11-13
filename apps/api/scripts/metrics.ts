/**
 * Metrics beta (plan §14) — chỉ in số tổng hợp, không in email, tên, sản phẩm hay số tiền.
 * Usage (local):   pnpm --filter @soi-don/api exec tsx --env-file=../../.env scripts/metrics.ts
 * Usage (Railway): railway run --service api pnpm --filter @soi-don/api exec tsx scripts/metrics.ts
 */
import { PrismaClient } from '@soi-don/db';

const prisma = new PrismaClient();
const DAY_MS = 24 * 3600 * 1000;
const ACTIVATION_MIN_ORDERS = 10;

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);
const row = (label: string, n: number, d: number) =>
  console.log(`${label.padEnd(34)} ${pct(n, d).padStart(7)}   (${n}/${d})`);

/** Tập userId đã có ít nhất một bản ghi audit với action này. */
async function usersWith(action: string): Promise<Set<string>> {
  const rows = await prisma.auditLog.findMany({
    where: { action, userId: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])));
}

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, createdAt: true },
  });
  const connected = await usersWith('gmail.connected');
  const active = await prisma.emailConnection.count({ where: { status: 'ACTIVE' } });
  const revoked = await prisma.emailConnection.count({ where: { status: 'REVOKED' } });

  console.log(
    `Người dùng: ${users.length} · kết nối Gmail đang hoạt động: ${active} · hết hạn/thu hồi: ${revoked}\n`,
  );

  // 1. Consent rate: đăng nhập rồi có kết nối Gmail không.
  row('Gmail consent rate', users.filter((u) => connected.has(u.id)).length, users.length);

  // 2. Activation: kết nối và có ≥ 10 đơn.
  const perUser = await prisma.transaction.groupBy({ by: ['userId'], _count: true });
  const activated = perUser.filter((p) => p._count >= ACTIVATION_MIN_ORDERS).length;
  row(`Activation (≥ ${ACTIVATION_MIN_ORDERS} đơn)`, activated, connected.size);

  // 3. Parse rate: email Shopee đã xử lý → đọc ra được đơn.
  const processed = await prisma.processedEmail.count();
  const parsed = await prisma.processedEmail.count({ where: { parsedOk: true } });
  row('Parse rate', parsed, processed);

  // 4. Accuracy (xấp xỉ): dòng sản phẩm người dùng không phải sửa danh mục bằng tay.
  const lines = await prisma.transactionItem.count();
  const manual = await prisma.transactionItem.count({ where: { categorySource: 'MANUAL' } });
  row('Dòng không phải sửa danh mục', lines - manual, lines);
  const uncategorized = await prisma.transactionItem.count({ where: { categoryId: null } });
  row('Dòng đã có danh mục', lines - uncategorized, lines);

  // 5. Week-4 retention: trong số người đăng ký ≥ 28 ngày trước, ai còn mở Tổng quan từ ngày 28 trở đi.
  const now = Date.now();
  const cohort = users.filter((u) => now - u.createdAt.getTime() >= 28 * DAY_MS);
  let retained = 0;
  for (const u of cohort) {
    const seen = await prisma.auditLog.findFirst({
      where: {
        userId: u.id,
        action: 'dashboard.viewed',
        createdAt: { gte: new Date(u.createdAt.getTime() + 28 * DAY_MS) },
      },
      select: { id: true },
    });
    if (seen) retained++;
  }
  row('Week-4 retention', retained, cohort.length);

  // Email chưa đọc được, theo loại — để biết cần bổ sung parser nào.
  const failed = await prisma.processedEmail.groupBy({
    by: ['templateId', 'eventType'],
    where: { parsedOk: false },
    _count: true,
    orderBy: { _count: { templateId: 'desc' } },
  });
  if (failed.length) {
    console.log('\nEmail chưa đọc được (theo parser / loại):');
    for (const f of failed) {
      console.log(
        `  ${String(f._count).padStart(5)}  ${f.templateId ?? '(không parser nào nhận)'} · ${f.eventType}`,
      );
    }
  }
}

main()
  .catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
