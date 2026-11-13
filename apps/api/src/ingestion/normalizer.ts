import { Injectable } from '@nestjs/common';
import type { EventType, Prisma, TxStatus } from '@soi-don/db';
import { type ParsedOrderEvent, productKey } from '@soi-don/shared';
import { autoCategories, reallocate } from '../categories/categorizer';
import { planItemSync } from '../categories/item-sync';
import { PrismaService } from '../prisma/prisma.service';
import { REVIEW_THRESHOLD } from '../parser/shopee.parsers';

type Tx = Prisma.TransactionClient;

export interface NormalizeResult {
  linked: boolean;
  created: boolean;
}

const REVIEW_REASON: Record<string, string> = {
  missing_order_id: 'Không đọc được mã đơn',
  missing_net_amount: 'Không đọc được tổng thanh toán',
  missing_items: 'Không đọc được sản phẩm',
  items_sum_mismatch: 'Tổng tiền sản phẩm không khớp',
  net_exceeds_gross: 'Tổng thanh toán lớn hơn tiền hàng + phí ship',
  payment_total_mismatch: 'Tổng các đơn không khớp số tiền thanh toán',
  subject_order_id_mismatch: 'Mã đơn trên tiêu đề khác nội dung',
};

/** Gộp các event cùng orderId thành một Transaction. Idempotent: chạy lại không tạo trùng. */
@Injectable()
export class Normalizer {
  constructor(private readonly prisma: PrismaService) {}

  async apply(
    userId: string,
    gmailMessageId: string,
    ev: ParsedOrderEvent,
  ): Promise<NormalizeResult> {
    if (!ev.orderId) return { linked: false, created: false };
    const orderId = ev.orderId;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { userId_platform_orderId: { userId, platform: ev.platform, orderId } },
      });
      const hasFullData = ev.netAmount !== undefined && ev.items.length > 0;
      const amounts = hasFullData
        ? {
            orderDate: ev.orderDate ?? ev.occurredAt,
            shopName: ev.shopName ?? null,
            grossAmount: ev.grossAmount ?? 0,
            discountAmount: ev.discountAmount ?? 0,
            shippingFee: ev.shippingFee ?? 0,
            netAmount: ev.netAmount ?? 0,
            confidence: ev.confidence,
          }
        : {};

      const t = existing
        ? await tx.transaction.update({ where: { id: existing.id }, data: amounts })
        : await tx.transaction.create({
            data: {
              userId,
              platform: ev.platform,
              orderId,
              fingerprint: `order:${orderId}`,
              orderDate: ev.orderDate ?? ev.occurredAt,
              confidence: ev.confidence,
              ...amounts,
            },
          });

      if (hasFullData) await this.syncItems(tx, userId, t.id, ev);

      await tx.orderEvent.upsert({
        where: { transactionId_gmailMessageId: { transactionId: t.id, gmailMessageId } },
        update: {
          type: ev.eventType as EventType,
          occurredAt: ev.occurredAt,
          amount: ev.refundAmount ?? null,
        },
        create: {
          transactionId: t.id,
          gmailMessageId,
          type: ev.eventType as EventType,
          occurredAt: ev.occurredAt,
          amount: ev.refundAmount ?? null,
        },
      });

      await this.recompute(tx, t.id, hasFullData ? ev.warnings : null);
      return { linked: true, created: !existing };
    });
  }

  /** Cập nhật dòng sản phẩm tại chỗ để giữ id và danh mục đã lưu, rồi tính lại phân bổ. */
  private async syncItems(tx: Tx, userId: string, transactionId: string, ev: ParsedOrderEvent) {
    const existing = await tx.transactionItem.findMany({
      where: { transactionId },
      select: { id: true, productName: true, variant: true, categoryId: true, categorySource: true },
    });
    const plan = planItemSync(existing, ev.items);
    const keyed = ev.items.map((it) => ({ productName: it.name, productKey: productKey(it.name) }));
    const auto = await autoCategories(
      tx,
      userId,
      keyed.filter((_, i) => !plan.lines[i].keepCategory),
    );

    if (plan.deleteIds.length)
      await tx.transactionItem.deleteMany({ where: { id: { in: plan.deleteIds } } });
    for (const [i, it] of ev.items.entries()) {
      const { existingId, keepCategory } = plan.lines[i];
      const a = auto.get(keyed[i].productKey);
      const data = {
        productName: it.name,
        variant: it.variant ?? null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
        productKey: keyed[i].productKey,
        ...(keepCategory
          ? {}
          : { categoryId: a?.categoryId ?? null, categorySource: a?.categorySource ?? null }),
      };
      if (existingId) await tx.transactionItem.update({ where: { id: existingId }, data });
      else await tx.transactionItem.create({ data: { transactionId, ...data } });
    }
    await reallocate(tx, transactionId);
  }

  /** Trạng thái là tổng hợp của mọi event của đơn. */
  private async recompute(tx: Tx, transactionId: string, latestWarnings: string[] | null) {
    const t = await tx.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { events: true },
    });
    const types = new Set(t.events.map((e) => e.type));
    const refund = t.events
      .filter((e) => e.type === 'REFUND')
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    let status: TxStatus = 'PENDING';
    if (types.has('ORDER_DELIVERED')) status = 'COMPLETED';
    if (types.has('ORDER_CANCELLED')) status = 'CANCELLED';
    if (refund > 0) status = refund >= t.netAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const reasons: string[] = [];
    if (t.confidence < REVIEW_THRESHOLD) {
      const fromWarnings = (latestWarnings ?? []).map((w) => REVIEW_REASON[w]).filter(Boolean);
      reasons.push(...(fromWarnings.length ? fromWarnings : ['Độ tin cậy thấp']));
    }
    if (types.has('RETURN_REQUESTED') && refund === 0)
      reasons.push('Có yêu cầu trả hàng, chưa rõ số tiền hoàn');

    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        refundAmount: refund,
        // Không ghi đè quyết định của người dùng.
        ...(t.userConfirmed
          ? {}
          : {
              needsReview: reasons.length > 0,
              reviewReason: reasons.length ? reasons.join('; ') : null,
            }),
      },
    });
  }
}
