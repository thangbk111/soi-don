/**
 * Tính lại trường dẫn xuất của dòng sản phẩm: productKey, giá trị phân bổ, và phân loại lại
 * theo quy tắc hiện tại cho dòng chưa phân loại hoặc do quy tắc có sẵn gán.
 * Không đụng dòng người dùng đã chọn tay (MANUAL) hay do quy tắc ghi nhớ gán (USER_RULE),
 * không sửa trường tiền gốc, không đọc Gmail.
 * Usage: pnpm --filter @soi-don/api exec tsx --env-file=../../.env scripts/recompute-items.ts
 */
import { PrismaClient } from '@soi-don/db';
import { productKey } from '@soi-don/shared';
import { autoCategories, reallocate } from '../src/categories/categorizer';

const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({ select: { id: true, userId: true } });
  let reclassified = 0;
  for (const t of txs) {
    await prisma.$transaction(async (db) => {
      const items = await db.transactionItem.findMany({
        where: { transactionId: t.id },
        select: { id: true, productName: true, categoryId: true, categorySource: true },
      });
      const keyed = items.map((it) => ({ ...it, productKey: productKey(it.productName) }));
      const open = keyed.filter((it) => it.categorySource === null || it.categorySource === 'RULE');
      const auto = await autoCategories(db, t.userId, open);
      for (const it of keyed) {
        const isOpen = it.categorySource === null || it.categorySource === 'RULE';
        const a = isOpen ? auto.get(it.productKey) : undefined;
        const next = isOpen
          ? { categoryId: a?.categoryId ?? null, categorySource: a?.categorySource ?? null }
          : {};
        if (isOpen && next.categoryId !== it.categoryId) reclassified++;
        await db.transactionItem.update({
          where: { id: it.id },
          data: { productKey: it.productKey, ...next },
        });
      }
      await reallocate(db, t.id);
    });
  }
  console.log(`Recomputed ${txs.length} orders, reclassified ${reclassified} lines`);
}

main().finally(() => prisma.$disconnect());
