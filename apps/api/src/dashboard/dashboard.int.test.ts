/**
 * Chạy trên Postgres thật, schema riêng `it_test`: pnpm --filter @soi-don/api test:int
 */
import {
  addDaysYmd,
  DEFAULT_CATEGORIES,
  type ParsedOrderEvent,
  rangeInstants,
  todayVn,
  vnDayStart,
} from '@soi-don/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import { Normalizer } from '../ingestion/normalizer';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsController } from '../transactions/transactions.controller';
import { DashboardController } from './dashboard.controller';

const prisma = new PrismaService();
const normalizer = new Normalizer(prisma);
const categories = new CategoriesService(prisma);
const transactions = new TransactionsController(prisma);
const dashboard = new DashboardController(prisma, new AuditService(prisma));

const today = todayVn();
const yesterday = addDaysYmd(today, -1);
// Giữa trưa giờ VN để không lệch ngày.
const noonOf = (ymd: string) => new Date(vnDayStart(ymd).getTime() + 12 * 3600 * 1000);
let userA = '';
let userB = '';
const cat: Record<string, string> = {};

const order = (
  orderId: string,
  items: [string, number][],
  over: Partial<ParsedOrderEvent> = {},
): ParsedOrderEvent => {
  const gross = items.reduce((s, [, p]) => s + p, 0);
  return {
    platform: 'SHOPEE',
    templateId: 'shopee.payment_confirmed.v1',
    eventType: 'ORDER_PLACED',
    occurredAt: noonOf(today),
    orderId,
    orderDate: noonOf(today),
    shopName: 'shop',
    items: items.map(([name, price]) => ({
      name,
      quantity: 1,
      unitPrice: price,
      lineTotal: price,
    })),
    grossAmount: gross,
    discountAmount: 0,
    shippingFee: 0,
    netAmount: gross,
    confidence: 1,
    warnings: [],
    ...over,
  };
};

const range = { from: today, to: today };
const get = (userId: string) => dashboard.get(userId, range.from, range.to);

beforeAll(async () => {
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  for (const [sortOrder, c] of DEFAULT_CATEGORIES.entries()) {
    const row = await prisma.category.create({
      data: { slug: c.slug, name: c.name, sortOrder, parentId: c.parent ? cat[c.parent] : null },
    });
    cat[c.slug] = row.id;
  }
  userA = (await prisma.user.create({ data: { email: 'a@test', googleSub: 'a' } })).id;
  userB = (await prisma.user.create({ data: { email: 'b@test', googleSub: 'b' } })).id;

  // Hai danh mục trong một đơn, có giảm giá và phí ship.
  await normalizer.apply(
    userA,
    'd1',
    order(
      'DASH0000000001',
      [
        ['Sữa rửa mặt CeraVe', 300_000],
        ['Nước giặt Ariel 4kg', 200_000],
      ],
      {
        discountAmount: 65_000,
        shippingFee: 15_000,
        netAmount: 450_000,
      },
    ),
  );
  // Tã (danh mục con của Mẹ và bé) + sản phẩm chưa phân loại; thiếu giá một phần → Chưa phân bổ.
  await normalizer.apply(
    userA,
    'd2',
    order(
      'DASH0000000002',
      [
        ['Tã quần Bobby size L', 100_000],
        ['Combo quà bí ẩn', 50_000],
      ],
      {
        grossAmount: 200_000,
        netAmount: 200_000,
      },
    ),
  );
  // Phí ship lớn hơn số thực trả → không phân bổ được, khoản điều chỉnh âm.
  await normalizer.apply(
    userA,
    'd3',
    order('DASH0000000003', [['Vật phẩm lạ', 10_000]], {
      discountAmount: 20_000,
      shippingFee: 30_000,
      netAmount: 20_000,
    }),
  );
  // Đơn hủy → không tính.
  await normalizer.apply(userA, 'd4', order('DASH0000000004', [['Tai nghe bluetooth', 900_000]]));
  await prisma.transaction.updateMany({
    where: { userId: userA, orderId: 'DASH0000000004' },
    data: { status: 'CANCELLED' },
  });
});

afterAll(() => prisma.$disconnect());

describe('GET /dashboard', () => {
  it('tổng khớp trang Đơn hàng với cùng khoảng ngày', async () => {
    const d = await get(userA);
    const list = await transactions.list(userA, range.from, range.to);
    const { orders, gross, discount, shipping, net, refund } = list.summary;
    expect(d.summary).toEqual({ orders, gross, discount, shipping, net, refund });
    expect(d.summary.orders).toBe(3);
    expect(d.summary.net).toBe(450_000 + 200_000 + 20_000);
  });

  it('danh mục + chưa phân bổ + điều chỉnh + phí ship = tổng thực trả', async () => {
    const { categories: c, summary } = await get(userA);
    const groupsSum = c.groups.reduce((s, g) => s + g.amount, 0);
    expect(groupsSum + c.unallocated + c.adjustment + c.shipping).toBe(summary.net);
    expect(c.shipping).toBe(45_000);
    expect(c.unallocated).toBe(50_000); // 200k thực trả, chỉ 150k/200k tiền hàng có giá dòng
    expect(c.adjustment).toBe(-10_000);
    expect(c.allocatedBase).toBe(groupsSum + 50_000);
    expect(c.linesWithoutValue).toBe(1);
  });

  it('nhóm theo danh mục cấp 1, có danh mục con, Chưa phân loại tách riêng', async () => {
    const { categories: c } = await get(userA);
    const by = (id: string | null) => c.groups.find((g) => g.id === id);
    expect(by(cat['lam-dep'])?.amount).toBe(261_000);
    expect(by(cat['gia-dung'])?.amount).toBe(174_000);
    const mevabe = by(cat['me-va-be']);
    expect(mevabe?.amount).toBe(100_000);
    expect(mevabe?.children.map((x) => x.id)).toEqual([cat['me-va-be-ta-ve-sinh']]);
    const unc = by(null);
    expect(unc).toMatchObject({
      name: 'Chưa phân loại',
      amount: 50_000,
      lines: 2,
      linesWithoutValue: 1,
    });
    // Giảm dần
    expect(c.groups.map((g) => g.amount)).toEqual(
      [...c.groups.map((g) => g.amount)].sort((a, b) => b - a),
    );
    // Đơn hủy không góp dòng nào
    expect(c.groups.some((g) => g.id === cat['dien-tu'])).toBe(false);
  });

  it('sửa danh mục làm báo cáo cập nhật', async () => {
    const items = await prisma.transactionItem.findMany({
      where: {
        transaction: { userId: userA, orderId: 'DASH0000000002' },
        productName: 'Combo quà bí ẩn',
      },
    });
    await categories.setItemsCategory(
      userA,
      items.map((i) => i.id),
      cat['khac'],
      false,
    );
    const { categories: c } = await get(userA);
    expect(c.groups.find((g) => g.id === cat['khac'])?.amount).toBe(50_000);
    expect(c.groups.find((g) => g.id === null)).toMatchObject({ amount: 0, lines: 1 });
  });

  it('biểu đồ thời gian dùng cùng tổng thực trả', async () => {
    const d = await get(userA);
    expect(d.granularity).toBe('day');
    expect(d.timeline).toEqual([{ key: today, range, net: d.summary.net, orders: 3 }]);
  });

  it('kỳ trước bằng 0 và chưa được quét', async () => {
    const d = await get(userA);
    expect(d.previous.range).toEqual({ from: yesterday, to: yesterday });
    expect(d.previous.summary.net).toBe(0);
    expect(d.previous.covered).toBe(false);
    expect(d.covered).toBe(false);
  });

  it('kỳ trước có đơn và đã quét', async () => {
    await normalizer.apply(
      userA,
      'd5',
      order('DASH0000000005', [['Sữa tươi', 70_000]], {
        orderDate: noonOf(yesterday),
        occurredAt: noonOf(yesterday),
      }),
    );
    const scan = rangeInstants({ from: addDaysYmd(today, -30), to: today });
    await prisma.scanJob.create({
      data: { userId: userA, status: 'DONE', rangeFrom: scan.start, rangeTo: scan.endExclusive },
    });
    const d = await get(userA);
    expect(d.previous.summary).toMatchObject({ orders: 1, net: 70_000 });
    expect(d.previous.covered).toBe(true);
    expect(d.covered).toBe(true);
    // Không lẫn đơn của kỳ trước vào kỳ hiện tại
    expect(d.summary.orders).toBe(3);
  });

  it('người dùng B không thấy dữ liệu của A', async () => {
    const d = await get(userB);
    expect(d.hasAnyOrders).toBe(false);
    expect(d.summary.orders).toBe(0);
    expect(d.categories.groups).toEqual([]);
    expect(d.previous.summary.net).toBe(0);
    expect(d.covered).toBe(false);
  });

  it('ghi lượt xem tối đa một lần mỗi ngày, riêng từng người', async () => {
    await get(userA);
    await get(userA);
    await get(userB);
    const views = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: { action: 'dashboard.viewed', userId: { in: [userA, userB] } },
      _count: true,
    });
    expect(Object.fromEntries(views.map((v) => [v.userId, v._count]))).toEqual({
      [userA]: 1,
      [userB]: 1,
    });
  });
});
