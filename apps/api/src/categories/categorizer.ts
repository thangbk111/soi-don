import type { CategorySource, Prisma } from '@soi-don/db';
import { allocateOrder, matchBuiltinCategory } from '@soi-don/shared';

type Db = Prisma.TransactionClient;

export interface AutoCategory {
  categoryId: string;
  categorySource: CategorySource;
}

/**
 * Danh mục tự động cho các khóa sản phẩm: quy tắc ghi nhớ của chính user → quy tắc có sẵn.
 * Không khớp → không có trong kết quả (= Chưa phân loại).
 */
export async function autoCategories(
  db: Db,
  userId: string,
  items: { productKey: string; productName: string }[],
): Promise<Map<string, AutoCategory>> {
  const keys = [...new Set(items.map((i) => i.productKey))];
  const out = new Map<string, AutoCategory>();
  if (!keys.length) return out;

  const rules = await db.categoryRule.findMany({
    where: { userId, match: 'PRODUCT_NAME', pattern: { in: keys } },
    select: { pattern: true, categoryId: true },
  });
  for (const r of rules) out.set(r.pattern, { categoryId: r.categoryId, categorySource: 'USER_RULE' });

  const slugs = new Map<string, string>();
  for (const it of items) {
    if (out.has(it.productKey)) continue;
    const slug = matchBuiltinCategory(it.productName);
    if (slug) slugs.set(it.productKey, slug);
  }
  if (slugs.size) {
    const cats = await db.category.findMany({
      where: { slug: { in: [...new Set(slugs.values())] } },
      select: { id: true, slug: true },
    });
    const idOf = new Map(cats.map((c) => [c.slug, c.id]));
    for (const [key, slug] of slugs) {
      const id = idOf.get(slug);
      if (id) out.set(key, { categoryId: id, categorySource: 'RULE' });
    }
  }
  return out;
}

/** Tính lại giá trị phân bổ của các dòng và phần chưa phân bổ của đơn. Không đụng trường tiền gốc. */
export async function reallocate(db: Db, transactionId: string) {
  const t = await db.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    select: {
      grossAmount: true,
      shippingFee: true,
      netAmount: true,
      items: { select: { id: true, lineTotal: true }, orderBy: { id: 'asc' } },
    },
  });
  const r = allocateOrder({
    grossAmount: t.grossAmount,
    shippingFee: t.shippingFee,
    netAmount: t.netAmount,
    lineTotals: t.items.map((i) => i.lineTotal),
  });
  await Promise.all(
    t.items.map((it, idx) =>
      db.transactionItem.update({ where: { id: it.id }, data: { allocatedAmount: r.lines[idx] } }),
    ),
  );
  await db.transaction.update({
    where: { id: transactionId },
    data: { unallocatedAmount: r.unallocated },
  });
}
