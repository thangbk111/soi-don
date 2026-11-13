import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  bucketKey,
  buckets,
  type DateRange,
  granularityOf,
  isCovered,
  mergeRanges,
  previousPeriod,
  rangeInstants,
  todayVn,
} from '@soi-don/shared';
import { AuditService } from '../audit/audit.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseRangeOrThrow } from '../common/date-range';
import { PrismaService } from '../prisma/prisma.service';
import { SPEND_STATUSES, spendTotals } from '../transactions/spend';
import { categoryBreakdown } from './breakdown';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * ?from=YYYY-MM-DD&to=YYYY-MM-DD — cùng cách lọc (ngày đặt hàng, giờ VN) và cùng quy tắc
   * tính chi tiêu với GET /transactions, để hai trang luôn ra cùng tổng.
   */
  @Get()
  async get(@UserId() userId: string, @Query('from') fromQ?: string, @Query('to') toQ?: string) {
    const { range, start, endExclusive } = parseRangeOrThrow({ from: fromQ, to: toQ });
    const previous = previousPeriod(range);
    const prev = rangeInstants(previous.range);

    const [txs, prevTxs, categories, scans, anyOrder] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          orderDate: { gte: start, lt: endExclusive },
          status: { in: SPEND_STATUSES },
        },
        select: {
          orderDate: true,
          grossAmount: true,
          discountAmount: true,
          shippingFee: true,
          netAmount: true,
          refundAmount: true,
          unallocatedAmount: true,
          items: { select: { categoryId: true, allocatedAmount: true } },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          orderDate: { gte: prev.start, lt: prev.endExclusive },
          status: { in: SPEND_STATUSES },
        },
        select: {
          grossAmount: true,
          discountAmount: true,
          shippingFee: true,
          netAmount: true,
          refundAmount: true,
        },
      }),
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
      this.prisma.scanJob.findMany({
        where: { userId, status: 'DONE' },
        select: { rangeFrom: true, rangeTo: true },
      }),
      this.prisma.transaction.findFirst({ where: { userId }, select: { id: true } }),
    ]);
    await this.markViewed(userId);

    // ScanJob lưu [00:00 ngày đầu, 00:00 ngày sau ngày cuối) giờ VN.
    const scanned: DateRange[] = scans.map((s) => ({
      from: todayVn(s.rangeFrom),
      to: todayVn(new Date(s.rangeTo.getTime() - 1)),
    }));

    const granularity = granularityOf(range);
    const timeline = buckets(range, granularity).map((b) => ({ ...b, net: 0, orders: 0 }));
    const index = new Map(timeline.map((b, i) => [b.key, i]));
    for (const t of txs) {
      const i = index.get(bucketKey(todayVn(t.orderDate), granularity));
      if (i === undefined) continue;
      timeline[i].net += t.netAmount;
      timeline[i].orders++;
    }

    return {
      range,
      previous: {
        range: previous.range,
        kind: previous.kind,
        covered: isCovered(previous.range, scanned),
        summary: spendTotals(prevTxs),
      },
      covered: isCovered(range, scanned),
      /** Các khoảng ngày đã quét Gmail xong, đã gộp. */
      scanned: mergeRanges(scanned),
      hasAnyOrders: anyOrder !== null,
      summary: spendTotals(txs),
      granularity,
      timeline,
      categories: categoryBreakdown(txs, categories),
    };
  }

  /** Đo retention (plan §14): ghi nhận lượt xem tối đa một lần mỗi ngày (giờ VN), không kèm dữ liệu. */
  private async markViewed(userId: string) {
    const { start } = rangeInstants({ from: todayVn(), to: todayVn() });
    const seen = await this.prisma.auditLog.findFirst({
      where: { userId, action: 'dashboard.viewed', createdAt: { gte: start } },
      select: { id: true },
    });
    if (!seen) await this.audit.log(userId, 'dashboard.viewed');
  }
}
