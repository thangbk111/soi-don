/**
 * Chạy trên Postgres thật, schema riêng `it_test` (không đụng dữ liệu dev): pnpm --filter @soi-don/api test:int
 */
import { NotFoundException } from '@nestjs/common';
import { DEFAULT_CATEGORIES, type ParsedOrderEvent, todayVn, UNCATEGORIZED } from '@soi-don/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Normalizer } from '../ingestion/normalizer';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsController } from '../transactions/transactions.controller';
import { CategoriesService } from './categories.service';

const prisma = new PrismaService();
const normalizer = new Normalizer(prisma);
const categories = new CategoriesService(prisma);
const transactions = new TransactionsController(prisma);

const today = todayVn();
const orderDate = new Date();
let userA = '';
let userB = '';
const cat: Record<string, string> = {};

const order = (orderId: string, items: [string, number][], over: Partial<ParsedOrderEvent> = {}) => {
  const gross = items.reduce((s, [, p]) => s + p, 0);
  return {
    platform: 'SHOPEE',
    templateId: 'shopee.payment_confirmed.v1',
    eventType: 'ORDER_PLACED',
    occurredAt: orderDate,
    orderId,
    orderDate,
    shopName: 'shop',
    items: items.map(([name, price]) => ({ name, quantity: 1, unitPrice: price, lineTotal: price })),
    grossAmount: gross,
    discountAmount: 0,
    shippingFee: 0,
    netAmount: gross,
    confidence: 1,
    warnings: [],
    ...over,
  } satisfies ParsedOrderEvent;
};

const itemsOf = (userId: string, orderId: string) =>
  prisma.transactionItem.findMany({
    where: { transaction: { userId, orderId } },
    orderBy: { productName: 'asc' },
  });

beforeAll(async () => {
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  for (const [sortOrder, c] of DEFAULT_CATEGORIES.entries()) {
    const row = await prisma.category.create({
      data: {
        slug: c.slug,
        name: c.name,
        sortOrder,
        parentId: c.parent ? cat[c.parent] : null,
      },
    });
    cat[c.slug] = row.id;
  }
  userA = (await prisma.user.create({ data: { email: 'a@test', googleSub: 'a' } })).id;
  userB = (await prisma.user.create({ data: { email: 'b@test', googleSub: 'b' } })).id;
});

afterAll(() => prisma.$disconnect());

describe('phân loại theo dòng sản phẩm', () => {
  it('một đơn có hai danh mục được chia đúng hai nhóm, phân bổ khớp thực trả', async () => {
    await normalizer.apply(
      userA,
      'm1',
      order('ORDER0000000001', [['Sữa rửa mặt CeraVe', 300_000], ['Nước giặt Ariel 4kg', 200_000]], {
        discountAmount: 65_000,
        shippingFee: 15_000,
        netAmount: 450_000,
      }),
    );
    const [ariel, cerave] = await itemsOf(userA, 'ORDER0000000001');
    expect(cerave.categoryId).toBe(cat['lam-dep']);
    expect(ariel.categoryId).toBe(cat['gia-dung']);
    expect(cerave.categorySource).toBe('RULE');
    // (450.000 − 15.000) chia 3:2
    expect(cerave.allocatedAmount).toBe(261_000);
    expect(ariel.allocatedAmount).toBe(174_000);
  });

  it('không khớp quy tắc nào → Chưa phân loại (null), không phải "Khác"', async () => {
    await normalizer.apply(userA, 'm2', order('ORDER0000000002', [['Combo quà bí ẩn', 99_000]]));
    const [it0] = await itemsOf(userA, 'ORDER0000000002');
    expect(it0.categoryId).toBeNull();
    expect(it0.categorySource).toBeNull();
  });

  it('sửa tay + ghi nhớ; nhập lại không mất; quy tắc chỉ áp dụng cho chính người dùng', async () => {
    const [it0] = await itemsOf(userA, 'ORDER0000000002');
    const res = await categories.setItemsCategory(userA, [it0.id], cat['khac'], true);
    expect(res).toEqual({ updated: 1, rulesSaved: 1, appliedToOthers: 0 });

    // Nhập lại đúng email đó (vd quét lại) → giữ id, giữ danh mục thủ công.
    await normalizer.apply(userA, 'm2', order('ORDER0000000002', [['Combo quà bí ẩn', 99_000]]));
    const [again] = await itemsOf(userA, 'ORDER0000000002');
    expect(again.id).toBe(it0.id);
    expect(again.categoryId).toBe(cat['khac']);
    expect(again.categorySource).toBe('MANUAL');

    // Đơn mới cùng sản phẩm của A → quy tắc ghi nhớ.
    await normalizer.apply(userA, 'm3', order('ORDER0000000003', [['Combo  QUÀ bí ẩn', 89_000]]));
    const [a3] = await itemsOf(userA, 'ORDER0000000003');
    expect(a3.categoryId).toBe(cat['khac']);
    expect(a3.categorySource).toBe('USER_RULE');

    // Người dùng B nhập cùng sản phẩm → không bị ảnh hưởng bởi quy tắc của A.
    await normalizer.apply(userB, 'm4', order('ORDER0000000004', [['Combo quà bí ẩn', 99_000]]));
    const [b4] = await itemsOf(userB, 'ORDER0000000004');
    expect(b4.categoryId).toBeNull();
  });

  it('nhập lại không ghi đè danh mục do quy tắc có sẵn đã gán', async () => {
    const [ariel] = await itemsOf(userA, 'ORDER0000000001');
    await categories.setItemsCategory(userA, [ariel.id], cat['khac'], false);
    await normalizer.apply(userA, 'm1-delivered', {
      ...order('ORDER0000000001', [['Sữa rửa mặt CeraVe', 300_000], ['Nước giặt Ariel 4kg', 200_000]], {
        discountAmount: 65_000,
        shippingFee: 15_000,
        netAmount: 450_000,
      }),
      eventType: 'ORDER_DELIVERED',
    });
    const [a, c] = await itemsOf(userA, 'ORDER0000000001');
    expect(a.categoryId).toBe(cat['khac']);
    expect(c.categoryId).toBe(cat['lam-dep']);
  });

  it('sửa hàng loạt; ghi nhớ áp dụng cho dòng cùng tên chưa chỉnh tay', async () => {
    await normalizer.apply(userA, 'm5', order('ORDER0000000005', [['Kem bôi da em bé', 120_000]]));
    await normalizer.apply(userA, 'm6', order('ORDER0000000006', [['Kem bôi da em bé', 120_000], ['Ghế ngồi', 1]]));
    const [k5] = await itemsOf(userA, 'ORDER0000000005');
    const six = await itemsOf(userA, 'ORDER0000000006');
    const res = await categories.setItemsCategory(
      userA,
      [k5.id, six.find((i) => i.productName === 'Ghế ngồi')!.id],
      cat['me-va-be-khac'],
      true,
    );
    expect(res).toEqual({ updated: 2, rulesSaved: 2, appliedToOthers: 1 });
    const k6 = (await itemsOf(userA, 'ORDER0000000006')).find((i) => i.productName === 'Kem bôi da em bé');
    expect(k6?.categoryId).toBe(cat['me-va-be-khac']);
    expect(k6?.categorySource).toBe('USER_RULE');
  });

  it('xóa quy tắc không đổi danh mục đã lưu', async () => {
    const rules = await categories.listRules(userA);
    const rule = rules.find((r) => r.label === 'Kem bôi da em bé')!;
    await categories.deleteRule(userA, rule.id);
    const k6 = (await itemsOf(userA, 'ORDER0000000006')).find((i) => i.productName === 'Kem bôi da em bé');
    expect(k6?.categoryId).toBe(cat['me-va-be-khac']);
  });

  it('không sửa được sản phẩm / quy tắc của người khác', async () => {
    const [b4] = await itemsOf(userB, 'ORDER0000000004');
    await expect(categories.setItemsCategory(userA, [b4.id], cat['khac'], false)).rejects.toThrow(
      NotFoundException,
    );
    const [ruleA] = await categories.listRules(userA);
    await expect(categories.deleteRule(userB, ruleA.id)).rejects.toThrow(NotFoundException);
    expect(await categories.listRules(userB)).toEqual([]);
  });
});

describe('lọc đơn theo danh mục', () => {
  it('danh mục cha gồm danh mục con; tách tiền thuộc danh mục khỏi tổng toàn đơn', async () => {
    const res = await transactions.list(userA, today, today, cat['me-va-be']);
    expect(res.transactions.map((t) => t.orderId).sort()).toEqual(['ORDER0000000005', 'ORDER0000000006']);
    expect(res.summary.net).toBe(120_000 + 120_001);
    expect(res.summary.category).toEqual({ amount: 120_000 + 120_001, lines: 3, linesWithoutValue: 0 });
    const t6 = res.transactions.find((t) => t.orderId === 'ORDER0000000006')!;
    expect(t6.items.every((i) => i.matchesFilter)).toBe(true);
  });

  it('lọc "Chưa phân loại" chỉ đánh dấu dòng chưa có danh mục', async () => {
    await normalizer.apply(userA, 'm7', order('ORDER0000000007', [['Tai nghe bluetooth', 500_000], ['Vật phẩm lạ', 100_000]]));
    const res = await transactions.list(userA, today, today, UNCATEGORIZED);
    expect(res.transactions.map((t) => t.orderId)).toEqual(['ORDER0000000007']);
    expect(res.summary.net).toBe(600_000);
    expect(res.summary.category?.amount).toBe(100_000);
    const marked = res.transactions[0].items.filter((i) => i.matchesFilter).map((i) => i.productName);
    expect(marked).toEqual(['Vật phẩm lạ']);
  });
});
