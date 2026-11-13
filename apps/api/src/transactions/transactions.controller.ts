import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { Prisma } from '@soi-don/db';
import { UNCATEGORIZED } from '@soi-don/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseRangeOrThrow } from '../common/date-range';
import { PrismaService } from '../prisma/prisma.service';
import { isCounted, spendTotals } from './spend';

@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  /**
   * ?from=YYYY-MM-DD&to=YYYY-MM-DD, lọc theo ngày đặt hàng (giờ VN), hai đầu đều tính.
   * ?category=<id>|uncategorized: chỉ đơn có ít nhất một dòng thuộc danh mục (gồm danh mục con).
   */
  async list(
    @UserId() userId: string,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
    @Query('category') categoryQ?: string,
  ) {
    const { range, start, endExclusive } = parseRangeOrThrow({ from: fromQ, to: toQ });
    const itemFilter = await this.categoryItemFilter(categoryQ);

    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        orderDate: { gte: start, lt: endExclusive },
        ...(itemFilter ? { items: { some: itemFilter.where } } : {}),
      },
      orderBy: { orderDate: 'desc' },
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            variant: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            allocatedAmount: true,
            categoryId: true,
            categorySource: true,
          },
          orderBy: { id: 'asc' },
        },
        events: { select: { type: true, occurredAt: true }, orderBy: { occurredAt: 'asc' } },
      },
    });

    const counted = txs.filter((t) => isCounted(t.status));

    // Email trả hàng không nêu mã đơn → chưa gắn được vào đơn nào.
    const returnEmails = await this.prisma.processedEmail.count({
      where: {
        userId,
        receivedAt: { gte: start, lt: endExclusive },
        eventType: { in: ['RETURN_REQUESTED', 'REFUND'] },
      },
    });
    const emailStats = await this.prisma.processedEmail.groupBy({
      by: ['templateId', 'parsedOk'],
      where: { userId, receivedAt: { gte: start, lt: endExclusive } },
      _count: true,
    });

    const matches = (categoryId: string | null) => !itemFilter || itemFilter.matches(categoryId);
    // Phần tiền thuộc danh mục đang lọc, chỉ tính trên đơn được tính vào chi tiêu.
    let category: { amount: number; lines: number; linesWithoutValue: number } | null = null;
    if (itemFilter) {
      category = { amount: 0, lines: 0, linesWithoutValue: 0 };
      for (const t of counted)
        for (const it of t.items) {
          if (!matches(it.categoryId)) continue;
          category.lines++;
          if (it.allocatedAmount === null) category.linesWithoutValue++;
          else category.amount += it.allocatedAmount;
        }
    }

    return {
      range,
      category: categoryQ ?? null,
      summary: {
        ...spendTotals(counted),
        needsReview: txs.filter((t) => t.needsReview).length,
        deliveredOnly: txs.filter((t) => t.events.every((e) => e.type === 'ORDER_DELIVERED'))
          .length,
        paymentOnly: txs.filter((t) => t.events.every((e) => e.type === 'ORDER_PLACED')).length,
        returnEmails,
        category,
      },
      emails: emailStats.map((s) => ({
        templateId: s.templateId,
        parsedOk: s.parsedOk,
        count: s._count,
      })),
      transactions: txs.map((t) => ({
        id: t.id,
        orderId: t.orderId,
        orderDate: t.orderDate,
        shopName: t.shopName,
        grossAmount: t.grossAmount,
        discountAmount: t.discountAmount,
        shippingFee: t.shippingFee,
        netAmount: t.netAmount,
        refundAmount: t.refundAmount,
        unallocatedAmount: t.unallocatedAmount,
        status: t.status,
        counted: isCounted(t.status),
        confidence: t.confidence,
        needsReview: t.needsReview,
        reviewReason: t.reviewReason,
        items: t.items.map((it) => ({ ...it, matchesFilter: !!itemFilter && matches(it.categoryId) })),
        events: t.events,
      })),
    };
  }

  /** Danh mục cha bao gồm các danh mục con. 400 nếu id không tồn tại. */
  private async categoryItemFilter(categoryQ: string | undefined): Promise<{
    where: Prisma.TransactionItemWhereInput;
    matches: (categoryId: string | null) => boolean;
  } | null> {
    if (!categoryQ) return null;
    if (categoryQ === UNCATEGORIZED)
      return { where: { categoryId: null }, matches: (id) => id === null };
    const cats = await this.prisma.category.findMany({
      where: { OR: [{ id: categoryQ }, { parentId: categoryQ }] },
      select: { id: true },
    });
    if (!cats.some((c) => c.id === categoryQ)) throw new BadRequestException('Danh mục không tồn tại');
    const ids = new Set(cats.map((c) => c.id));
    return {
      where: { categoryId: { in: [...ids] } },
      matches: (id) => id !== null && ids.has(id),
    };
  }
}
